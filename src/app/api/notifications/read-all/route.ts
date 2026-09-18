// POST /api/notifications/read-all — mark every notification as read.
// → { ok: true }

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await db.notification.updateMany({
    where: { userId: session.sub, read: false },
    data: { read: true },
  });
  return NextResponse.json({ ok: true });
}
