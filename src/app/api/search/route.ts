import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  emptySearchResults,
  SEARCH_MIN_QUERY,
  SEARCH_PER_GROUP,
  searchExcerpt,
  searchMatches,
  searchTotal,
} from "@/lib/search";
import type {
  SearchNoteHit,
  SearchProjectHit,
  SearchThreadHit,
} from "@/lib/types";

export const dynamic = "force-dynamic";

/* ── GET /api/search?q=…&workspaceId=… — current user only; optional workspace ── */

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const workspaceId = (url.searchParams.get("workspaceId") ?? "").trim() || null;

  if (workspaceId) {
    const owned = await db.project.findFirst({
      where: { id: workspaceId, userId: session.sub, archived: false },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
    }
  }

  if (q.length < SEARCH_MIN_QUERY) {
    return NextResponse.json(emptySearchResults());
  }
  const needle = q.toLowerCase();

  const [threads, notes, projects] = await Promise.all([
    db.thread.findMany({
      where: {
        userId: session.sub,
        archived: false,
        ...(workspaceId ? { projectId: workspaceId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
      select: {
        id: true,
        title: true,
        mode: true,
        projectId: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 3,
          where: { role: { in: ["user", "assistant"] } },
          select: { content: true, role: true },
        },
      },
    }),
    db.note.findMany({
      where: {
        userId: session.sub,
        ...(workspaceId
          ? { links: { some: { projectId: workspaceId } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        rawText: true,
        status: true,
        favorite: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
      },
    }),
    db.project.findMany({
      where: {
        userId: session.sub,
        archived: false,
        ...(workspaceId ? { id: workspaceId } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        origin: true,
        updatedAt: true,
      },
    }),
  ]);

  const threadHits: SearchThreadHit[] = threads
    .filter(
      (t) =>
        searchMatches(t.title, needle) ||
        t.messages.some((m) => searchMatches(m.content, needle)),
    )
    .slice(0, SEARCH_PER_GROUP)
    .map((t) => {
      const message = t.messages.find((m) => searchMatches(m.content, needle));
      return {
        id: t.id,
        title: t.title,
        mode: t.mode as SearchThreadHit["mode"],
        projectId: t.projectId,
        updatedAt: t.updatedAt.toISOString(),
        preview: message ? searchExcerpt(message.content, needle) : null,
      };
    });

  const noteHits: SearchNoteHit[] = notes
    .filter((n) => searchMatches(n.rawText, needle))
    .slice(0, SEARCH_PER_GROUP)
    .map((n) => ({
      id: n.id,
      preview: searchExcerpt(n.rawText ?? "", needle, 60),
      status: n.status as SearchNoteHit["status"],
      favorite: n.favorite,
      createdAt: n.createdAt.toISOString(),
      category: n.category
        ? { id: n.category.id, name: n.category.name }
        : null,
    }));

  const projectHits: SearchProjectHit[] = projects
    .filter((p) => searchMatches(p.name, needle) || searchMatches(p.description, needle))
    .slice(0, SEARCH_PER_GROUP)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      origin: p.origin as SearchProjectHit["origin"],
      updatedAt: p.updatedAt.toISOString(),
    }));

  const results = {
    threads: threadHits,
    notes: noteHits,
    projects: projectHits,
    total: 0,
  };
  results.total = searchTotal(results);
  return NextResponse.json(results);
}
