// GET /api/admin/users — user list with content counters + last activity.
//
//   ?q=     — substring filter on name/email (JS, Cyrillic-safe)
//   ?role=  — 'admin' | 'client'
//
// Counts and last-activity come from 3 groupBy queries (notes / threads /
// projects), then everything is merged in JS. Personal-scale cap 500;
// JSON has hasMore when the unfiltered fetch overflowed. UI does not paginate yet.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { lastActivityOf } from "@/lib/admin-activity";
import {
  MAX_ADMIN_USERS,
  ROLE_PARAM_INVALID,
  USERS_LOAD_ERROR,
  toPublicAdminUserListItem,
  usersPageHasMore,
} from "@/lib/admin-users-copy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const role = url.searchParams.get("role")?.trim() ?? "";
  if (role && role !== "admin" && role !== "client") {
    return NextResponse.json({ error: ROLE_PARAM_INVALID }, { status: 400 });
  }

  let users;
  let noteAgg;
  let threadAgg;
  let projectAgg;
  try {
    [users, noteAgg, threadAgg, projectAgg] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_ADMIN_USERS + 1,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.note.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    db.thread.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
    db.project.groupBy({
      by: ["userId"],
      _count: { _all: true },
      _max: { updatedAt: true },
    }),
  ]);
  } catch {
    console.error("[admin/users] list failed");
    return NextResponse.json({ error: USERS_LOAD_ERROR }, { status: 500 });
  }

  const hasMore = usersPageHasMore(users.length, MAX_ADMIN_USERS);
  const page = hasMore ? users.slice(0, MAX_ADMIN_USERS) : users;

  const noteBy = new Map(noteAgg.map((a) => [a.userId, a]));
  const threadBy = new Map(threadAgg.map((a) => [a.userId, a]));
  const projectBy = new Map(projectAgg.map((a) => [a.userId, a]));

  const list = page
    .filter((u) => (role ? u.role === role : true))
    .filter((u) =>
      q ? u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) : true,
    )
    .map((u) => {
      const lastActivity = lastActivityOf([
        noteBy.get(u.id)?._max.updatedAt,
        threadBy.get(u.id)?._max.updatedAt,
        projectBy.get(u.id)?._max.updatedAt,
      ]);
      return toPublicAdminUserListItem({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        lastActivity,
        counts: {
          notes: noteBy.get(u.id)?._count._all ?? 0,
          threads: threadBy.get(u.id)?._count._all ?? 0,
          projects: projectBy.get(u.id)?._count._all ?? 0,
        },
      });
    });

  return NextResponse.json({ users: list, hasMore });
}
