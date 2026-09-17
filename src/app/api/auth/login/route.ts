import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { signSession, verifyPassword, sessionCookieOptions } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth-shared";
import { ensureAdminSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z
    .string({ message: "Укажите email" })
    .trim()
    .toLowerCase()
    .email("Некорректный email"),
  password: z.string({ message: "Укажите пароль" }).min(1, "Укажите пароль"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  const { email, password } = parsed.data;

  // Ensure seeded admin exists so it can log in.
  await ensureAdminSeed();

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }

  // Best-effort audit log.
  try {
    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "auth.login",
        entity: "user",
        entityId: user.id,
      },
    });
  } catch (err) {
    console.error("[audit] auth.login failed:", err);
  }

  const token = await signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
