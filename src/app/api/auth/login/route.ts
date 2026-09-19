import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { attachSessionCookie, signSession, verifyPassword } from "@/lib/auth";
import { ensureAdminSeed } from "@/lib/seed";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";

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
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const rateKey = `login:${email}:${ip}`;
  const gated = consumeRateLimit(rateKey, 8, 15 * 60 * 1000);
  if (!gated.ok) {
    return NextResponse.json(
      { error: "Слишком много попыток входа. Подождите и попробуйте снова." },
      { status: 429, headers: { "retry-after": String(gated.retryAfterSec) } },
    );
  }

  // Ensure seeded admin exists so it can log in.
  await ensureAdminSeed();

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }
  resetRateLimit(rateKey);

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
    // Session token for Bearer auth — cookies are blocked in third-party
    // iframe contexts (sandbox preview panel), so the client falls back to
    // the Authorization header with this token.
    token,
  });
  attachSessionCookie(res, token);
  return res;
}
