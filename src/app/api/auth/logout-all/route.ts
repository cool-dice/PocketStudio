import { NextResponse } from "next/server";

import { clearSessionCookies, getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/* POST /api/auth/logout-all — bump tokenVersion, clear this cookie. */
export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.sub },
    data: { tokenVersion: { increment: 1 } },
  });

  try {
    await db.auditLog.create({
      data: {
        userId: session.sub,
        action: "auth.logout_all",
        entity: "user",
        entityId: session.sub,
      },
    });
  } catch (err) {
    console.error("[audit] auth.logout_all failed:", err);
  }

  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}
