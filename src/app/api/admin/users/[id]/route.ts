// PATCH /api/admin/users/[id] — change a user's role (admin ⇄ client).
// DELETE /api/admin/users/[id] — delete a user with ALL their content
//                                (DB cascade) + workspace directories.
//
// Guards:
//   PATCH  — never yourself («Нельзя изменить собственную роль»);
//            demoting the LAST admin is refused (409). Admin rows are
//            locked FOR UPDATE so two concurrent last-admin demotes
//            cannot both commit.
//   DELETE — never yourself; workspace dirs are removed best-effort;
//            the audit log keeps the trace (userId SetNull).
// Both actions are audit-logged as admin.role_change / admin.user_delete.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import {
  LAST_ADMIN_DELETE,
  SELF_USER_DELETE,
  USER_NOT_FOUND,
  roleChangeBlock,
  roleChangeError,
} from "@/lib/admin-users-copy";
import { lockAndCountAdmins } from "@/lib/admin-role-lock";
import { publicUserDto } from "@/lib/user-dto";
import { removeProjectDir } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const roleSchema = z.object({
  role: z.enum(["admin", "client"], {
    message: "Роль должна быть admin или client",
  }),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const body: unknown = await req.json().catch(() => null);
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  let fromRole: string;
  let updated;
  try {
    const result = await db.$transaction(async (tx) => {
      const adminCount = await lockAndCountAdmins(tx);
      const target = await tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          onboardingDone: true,
        },
      });
      if (!target) {
        throw Object.assign(new Error("not-found"), { code: "NOT_FOUND" });
      }
      const block = roleChangeBlock({
        actorId: guard.userId,
        targetId: target.id,
        targetRole: target.role,
        nextRole: parsed.data.role,
        adminCount,
      });
      if (block) {
        throw Object.assign(new Error(block), { code: block });
      }
      const row = await tx.user.update({
        where: { id: target.id },
        data: { role: parsed.data.role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          onboardingDone: true,
        },
      });
      const demotingAdmin =
        target.role === "admin" && parsed.data.role === "client";
      if (demotingAdmin) {
        const remaining = await tx.user.count({ where: { role: "admin" } });
        if (remaining < 1) {
          throw Object.assign(new Error("last-admin"), { code: "last-admin" });
        }
      }
      return { from: target.role, user: row };
    });
    fromRole = result.from;
    updated = result.user;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: USER_NOT_FOUND }, { status: 404 });
    }
    if (code === "last-admin" || code === "self") {
      return NextResponse.json(
        { error: roleChangeError(code) },
        { status: 409 },
      );
    }
    throw err;
  }

  await db.auditLog.create({
    data: {
      userId: guard.userId,
      action: "admin.role_change",
      entity: "user",
      entityId: updated.id,
      meta: JSON.stringify({ from: fromRole, to: parsed.data.role }),
    },
  });

  return NextResponse.json({ user: publicUserDto(updated) });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: USER_NOT_FOUND }, { status: 404 });
  }
  if (target.id === guard.userId) {
    return NextResponse.json({ error: SELF_USER_DELETE }, { status: 409 });
  }
  if (target.role === "admin") {
    const adminCount = await db.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: LAST_ADMIN_DELETE }, { status: 409 });
    }
  }

  // Remove workspace dirs first (row cascade will erase the DB side).
  const projects = await db.project.findMany({
    where: { userId: target.id },
    select: { id: true },
  });
  for (const p of projects) {
    try {
      await removeProjectDir(p.id);
    } catch (err) {
      console.warn(
        `[admin] workspace dir removal failed for project ${p.id}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  await db.auditLog.create({
    data: {
      userId: guard.userId,
      action: "admin.user_delete",
      entity: "user",
      entityId: target.id,
      meta: JSON.stringify({ email: target.email, name: target.name }),
    },
  });

  // Cascades: notes/categories/tags/projects/threads/messages/runs/events/
  // notifications; auditLog rows SetNull (the trace above survives).
  await db.user.delete({ where: { id: target.id } });

  return NextResponse.json({ ok: true });
}
