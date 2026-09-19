import { NextResponse } from "next/server";

import {
  attachSessionCookie,
  getUserFromRequest,
  signSession,
} from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PROFILE_NOTHING_TO_SAVE,
  validateDisplayName,
} from "@/lib/profile-copy";
import { publicUserDto } from "@/lib/user-dto";

export const dynamic = "force-dynamic";

async function loadSessionUser(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) return { error: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }) };
  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    return { error: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }) };
  }
  return { user };
}

export async function GET(req: Request) {
  const loaded = await loadSessionUser(req);
  if ("error" in loaded) return loaded.error;
  return NextResponse.json({ user: publicUserDto(loaded.user) });
}

/* PATCH /api/me — self only (no user id in the path). */
export async function PATCH(req: Request) {
  const loaded = await loadSessionUser(req);
  if ("error" in loaded) return loaded.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, "name")) {
    return NextResponse.json({ error: PROFILE_NOTHING_TO_SAVE }, { status: 400 });
  }

  const parsed = validateDisplayName(record.name);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, fields: { name: parsed.error } },
      { status: 400 },
    );
  }

  const updated = await db.user.update({
    where: { id: loaded.user.id },
    data: { name: parsed.name },
  });

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
