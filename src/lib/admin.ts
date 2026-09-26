// Admin guard for /api/admin/* routes.
//
// IMPORTANT: the role is read FRESH from the DB — the session JWT embeds
// the role at issue time, so a promoted/demoted user would otherwise keep
// their old powers until the cookie expires (up to 7 days).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export type AdminGuard =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

/** Resolve the requesting admin, or a ready-to-return 401/403 response. */
export async function requireAdmin(req: Request): Promise<AdminGuard> {
  const session = await getUserFromRequest(req);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }),
    };
  }
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { role: true },
  });
  if (!user || user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Доступ только для администраторов" },
        { status: 403 },
      ),
    };
  }
  return { ok: true, userId: session.sub, email: session.email };
}
