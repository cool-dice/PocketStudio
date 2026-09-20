import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { reminderDedupeKey } from "@/lib/notification-merge";

export const dynamic = "force-dynamic";

/**
 * POST /api/notes/reminders/fire
 * Create bell notifications for due notes (remindAt <= now) that don't
 * already have a reminder notification. Idempotent per note.
 */
export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const due = await db.note.findMany({
    where: {
      userId: session.sub,
      remindAt: { not: null, lte: new Date() },
    },
    select: { id: true, rawText: true, remindAt: true },
    take: 30,
  });
  if (due.length === 0) {
    return NextResponse.json({ fired: 0, notes: [] as { id: string; preview: string }[] });
  }

  const existing = await db.notification.findMany({
    where: {
      userId: session.sub,
      type: "reminder",
      entityId: { in: due.map((n) => n.id) },
    },
    select: { entityId: true },
  });
  const have = new Set(existing.map((n) => n.entityId).filter(Boolean));
  const fresh = due.filter((n) => !have.has(n.id));

  const created: {
    id: string;
    preview: string;
    notification: {
      id: string;
      type: string;
      title: string;
      body: string | null;
      entityId: string | null;
      dedupeKey?: string | null;
      read: boolean;
      createdAt: string;
    };
  }[] = [];
  for (const note of fresh) {
    const preview = (note.rawText ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
    try {
      const row = await db.notification.create({
        data: {
          userId: session.sub,
          type: "reminder",
          title: "Напоминание из блокнота",
          body: preview || "Пора вернуться к мысли",
          entityId: note.id,
          dedupeKey: reminderDedupeKey(note.id),
        },
      });
      created.push({
        id: note.id,
        preview: preview || "Мысль",
        notification: {
          id: row.id,
          type: row.type,
          title: row.title,
          body: row.body,
          entityId: row.entityId,
          read: row.read,
          createdAt: row.createdAt.toISOString(),
          dedupeKey: row.dedupeKey,
        },
      });
    } catch {
      // Race with another poll — skip duplicate.
    }
  }

  return NextResponse.json({ fired: created.length, notes: created });
}
