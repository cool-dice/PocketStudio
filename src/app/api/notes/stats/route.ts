import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/notes/stats — 14-day note activity for the notebook chart. */
export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 13);
  since.setUTCHours(0, 0, 0, 0);

  const notes = await db.note.findMany({
    where: { userId: session.sub, createdAt: { gte: since } },
    select: { createdAt: true, status: true, remindAt: true },
  });

  const days: { date: string; total: number; processed: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, total: 0, processed: 0 });
  }
  const byKey = new Map(days.map((d) => [d.date, d]));
  for (const note of notes) {
    const key = note.createdAt.toISOString().slice(0, 10);
    const bucket = byKey.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (note.status === "processed") bucket.processed += 1;
  }

  const due = await db.note.count({
    where: {
      userId: session.sub,
      remindAt: { not: null, lte: new Date() },
    },
  });

  return NextResponse.json({
    days,
    dueReminders: due,
    total14d: notes.length,
  });
}
