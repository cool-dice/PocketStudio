import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { attachSessionCookie, hashPassword, signSession } from "@/lib/auth";
import { ensureAdminSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z
    .string({ message: "Укажите имя" })
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(60, "Имя не может превышать 60 символов"),
  email: z
    .string({ message: "Укажите email" })
    .trim()
    .toLowerCase()
    .email("Некорректный email"),
  password: z
    .string({ message: "Укажите пароль" })
    .min(8, "Пароль должен содержать минимум 8 символов"),
  invite: z.string().trim().min(8).max(80).optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  const { name, email, password, invite: inviteToken } = parsed.data;

  // Seed env admin first so it takes priority over "first user becomes admin".
  await ensureAdminSeed();

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await db.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        throw Object.assign(new Error("email-taken"), { code: "EMAIL_TAKEN" });
      }

      let inviteRole: string | null = null;
      if (inviteToken) {
        const invite = await tx.invite.findUnique({ where: { token: inviteToken } });
        if (!invite || invite.usedAt) {
          throw Object.assign(new Error("invite-invalid"), { code: "INVITE_INVALID" });
        }
        if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
          throw Object.assign(new Error("invite-expired"), { code: "INVITE_EXPIRED" });
        }
        if (invite.email && invite.email !== email) {
          throw Object.assign(new Error("invite-email"), { code: "INVITE_EMAIL" });
        }
        inviteRole = invite.role;
      }

      const userCount = await tx.user.count();
      const created = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          role: inviteRole ?? (userCount === 0 ? "admin" : "client"),
        },
      });

      if (inviteToken) {
        const consumed = await tx.invite.updateMany({
          where: { token: inviteToken, usedAt: null },
          data: { usedAt: new Date() },
        });
        if (consumed.count !== 1) {
          throw Object.assign(new Error("invite-invalid"), { code: "INVITE_INVALID" });
        }
      }
      return created;
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "EMAIL_TAKEN") {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 },
      );
    }
    if (code === "INVITE_EXPIRED") {
      return NextResponse.json({ error: "Срок инвайта истёк" }, { status: 400 });
    }
    if (code === "INVITE_EMAIL") {
      return NextResponse.json(
        { error: "Этот инвайт выписан на другой email" },
        { status: 400 },
      );
    }
    if (code === "INVITE_INVALID") {
      return NextResponse.json({ error: "Инвайт недействителен" }, { status: 400 });
    }
    if (code === "P2002") {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 409 },
      );
    }
    throw err;
  }

  // Best-effort audit log.
  try {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.register",
        entity: "user",
        entityId: user.id,
      },
    });
  } catch (err) {
    console.error("[audit] auth.register failed:", err);
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const res = NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      // Session token for Bearer auth — cookies are blocked in third-party
      // iframe contexts (sandbox preview panel), so the client falls back to
      // the Authorization header with this token.
      token,
    },
    { status: 201 }
  );
  attachSessionCookie(res, token);
  return res;
}
