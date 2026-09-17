// /api/notifications — bell history (Stage 4b).
//
//   GET    → { notifications: Notification[], unread: number }  (latest 50)
//   DELETE → { ok: true }  — clear the whole bell history
//
// Rows are created by the agent-service (analysis_ready / project_created /
// checkpoint / system) which also pushes "notification:new" over WS.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const LIST_LIMIT = 50;

function serialize(n: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    entityId: n.entityId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    }),
    db.notification.count({ where: { userId: session.sub, read: false } }),
  ]);

  return NextResponse.json({
    notifications: notifications.map(serialize),
    unread,
  });
}

export async function DELETE(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  await db.notification.deleteMany({ where: { userId: session.sub } });
  return NextResponse.json({ ok: true });
}
