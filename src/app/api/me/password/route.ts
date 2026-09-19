import { NextResponse } from "next/server";

import {
  attachSessionCookie,
  getUserFromRequest,
  hashPassword,
  signSession,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PASSWORD_RATE_LIMITED,
  PASSWORD_UNCHANGED,
  PASSWORD_WRONG_CURRENT,
  validatePasswordChange,
} from "@/lib/password-copy";
import { consumeRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { publicUserDto } from "@/lib/user-dto";

export const dynamic = "force-dynamic";

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

async function loadSessionUser(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return {
      error: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }),
    };
  }
  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    return {
      error: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }),
    };
  }
  return { user };
}

/* PATCH /api/me/password — current + new + confirm. Self only. */
export async function PATCH(req: Request) {
  const loaded = await loadSessionUser(req);
  if ("error" in loaded) return loaded.error;

  const body = await req.json().catch(() => null);
  const parsed = validatePasswordChange(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fields: parsed.fields },
      { status: 400 },
    );
  }

  const rateKey = `password:${loaded.user.id}:${clientIp(req)}`;
  const gated = consumeRateLimit(rateKey, 8, 15 * 60 * 1000);
  if (!gated.ok) {
    return NextResponse.json(
      { error: PASSWORD_RATE_LIMITED },
      { status: 429, headers: { "retry-after": String(gated.retryAfterSec) } },
    );
  }

  const currentOk = await verifyPassword(
    parsed.currentPassword,
    loaded.user.passwordHash,
  );
  if (!currentOk) {
    return NextResponse.json(
      {
        error: PASSWORD_WRONG_CURRENT,
        fields: { currentPassword: PASSWORD_WRONG_CURRENT },
      },
      { status: 400 },
    );
  }

  if (parsed.currentPassword === parsed.newPassword) {
    return NextResponse.json(
      {
        error: PASSWORD_UNCHANGED,
        fields: { newPassword: PASSWORD_UNCHANGED },
      },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(parsed.newPassword);
  const updated = await db.user.update({
    where: { id: loaded.user.id },
    data: { passwordHash },
  });
  resetRateLimit(rateKey);

  try {
    await db.auditLog.create({
      data: {
        userId: updated.id,
        action: "auth.password_change",
        entity: "user",
        entityId: updated.id,
      },
    });
  } catch (err) {
    console.error("[audit] auth.password_change failed:", err);
  }

  const token = await signSession({
    sub: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
  });

  const res = NextResponse.json({
    user: publicUserDto(updated),
    token,
  });
  attachSessionCookie(res, token);
  return res;
}
