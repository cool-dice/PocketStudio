// GET /api/admin/stats — platform overview for the admin panel (Stage 4b).
//
// Honest scope: personal-scale counts + a 14-day activity sparkline built
// from createdAt timestamps bucketed in JS (date buckets stay in process;
// the row counts are bounded anyway).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const ACTIVITY_DAYS = 14;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (ACTIVITY_DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  let users: number;
  let admins: number;
  let notes: number;
  let notesProcessed: number;
  let notesError: number;
  let categories: number;
  let projects: number;
  let workspaces: number;
  let threads: number;
  let messages: number;
  let notifications: number;
  let newUsers7d: number;
  let noteDates: { createdAt: Date }[];
  let threadDates: { createdAt: Date }[];
  let projectDates: { createdAt: Date }[];
  try {
    [
      users,
      admins,
      notes,
      notesProcessed,
      notesError,
      categories,
      projects,
      workspaces,
      threads,
      messages,
      notifications,
      newUsers7d,
      noteDates,
      threadDates,
      projectDates,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { role: "admin" } }),
      db.note.count(),
      db.note.count({ where: { status: "processed" } }),
      db.note.count({ where: { status: "error" } }),
      db.category.count(),
      db.project.count(),
      db.project.count({ where: { origin: "workspace" } }),
      db.thread.count(),
      db.message.count(),
      db.notification.count(),
      db.user.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } },
      }),
      db.note.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      db.thread.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      db.project.findMany({
        where: { createdAt: { gte: since }, origin: "workspace" },
        select: { createdAt: true },
      }),
    ]);
  } catch {
    console.error("[admin/stats] failed");
    return NextResponse.json(
      { error: "Не удалось загрузить статистику" },
      { status: 500 },
    );
  }

  // Build the 14-day activity series (all zero-filled days included).
  const buckets = new Map<string, { date: string; notes: number; threads: number; projects: number }>();
  for (let i = 0; i < ACTIVITY_DAYS; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    const key = dayKey(d);
    buckets.set(key, { date: key, notes: 0, threads: 0, projects: 0 });
  }
  for (const { createdAt } of noteDates) {
    const b = buckets.get(dayKey(createdAt));
    if (b) b.notes++;
  }
  for (const { createdAt } of threadDates) {
    const b = buckets.get(dayKey(createdAt));
    if (b) b.threads++;
  }
  for (const { createdAt } of projectDates) {
    const b = buckets.get(dayKey(createdAt));
    if (b) b.projects++;
  }

  return NextResponse.json({
    stats: {
      users,
      admins,
      newUsers7d,
      notes,
      notesProcessed,
      notesError,
      categories,
      projects,
      workspaces,
      threads,
      messages,
      notifications,
      activity: Array.from(buckets.values()),
    },
  });
}
