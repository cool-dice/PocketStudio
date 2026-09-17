// PATCH /api/admin/users/[id] — change a user's role (admin ⇄ client).
// DELETE /api/admin/users/[id] — delete a user with ALL their content
//                                (DB cascade) + workspace directories.
//
// Guards:
//   PATCH  — never yourself («Нельзя изменить собственную роль»);
//            demoting the LAST admin is refused (409).
//   DELETE — never yourself; workspace dirs are removed best-effort;
//            the audit log keeps the trace (userId SetNull).
// Both actions are audit-logged as admin.role_change / admin.user_delete.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
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

  const target = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (target.id === guard.userId) {
    return NextResponse.json(
      { error: "Нельзя изменить собственную роль" },
      { status: 409 },
    );
  }
  if (target.role === "admin" && parsed.data.role === "client") {
    const admins = await db.user.count({ where: { role: "admin" } });
    if (admins <= 1) {
      return NextResponse.json(
        { error: "Нельзя снять последнего администратора" },
        { status: 409 },
      );
    }
  }

  const updated = await db.user.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  await db.auditLog.create({
    data: {
      userId: guard.userId,
      action: "admin.role_change",
      entity: "user",
      entityId: target.id,
      meta: JSON.stringify({ from: target.role, to: parsed.data.role }),
    },
  });

  return NextResponse.json({
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
    },
  });
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
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }
  if (target.id === guard.userId) {
    return NextResponse.json(
      { error: "Нельзя удалить свой аккаунт из админ-панели" },
      { status: 409 },
    );
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
