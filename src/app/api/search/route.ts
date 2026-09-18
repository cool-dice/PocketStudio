import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/* ── GET /api/search?q=… — global search across threads, notes, projects ── */

const MIN_QUERY = 2;
const PER_GROUP = 5;

/** Case-insensitive substring test (SQLite LIKE is ASCII-only, JS is honest). */
function matches(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle);
}

/** Short preview around the first match, with ellipses when trimmed. */
function excerpt(text: string, needle: string, radius = 42): string {
  const idx = text.toLowerCase().indexOf(needle);
  if (idx < 0) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + needle.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < MIN_QUERY) {
    return NextResponse.json({
      threads: [],
      notes: [],
      projects: [],
      total: 0,
    });
  }
  const needle = q.toLowerCase();

  // Personal-workspace scale: fetch bounded slices and match in JS —
  // case-insensitive both for ASCII and Cyrillic (unlike SQLite LIKE).
  const [threads, notes, projects] = await Promise.all([
    db.thread.findMany({
      where: { userId: session.sub, archived: false },
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
      where: { userId: session.sub },
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
      where: { userId: session.sub },
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

  const threadHits = threads
    .filter(
      (t) =>
        matches(t.title, needle) ||
        t.messages.some((m) => matches(m.content, needle)),
    )
    .slice(0, PER_GROUP)
    .map((t) => {
      const message = t.messages.find((m) => matches(m.content, needle));
      return {
        id: t.id,
        title: t.title,
        mode: t.mode,
        projectId: t.projectId,
        updatedAt: t.updatedAt.toISOString(),
        preview: message ? excerpt(message.content, needle) : null,
      };
    });

  const noteHits = notes
    .filter((n) => matches(n.rawText, needle))
    .slice(0, PER_GROUP)
    .map((n) => ({
      id: n.id,
      preview: excerpt(n.rawText ?? "", needle, 60),
      status: n.status,
      favorite: n.favorite,
      createdAt: n.createdAt.toISOString(),
      category: n.category
        ? { id: n.category.id, name: n.category.name }
        : null,
    }));

  const projectHits = projects
    .filter(
      (p) => matches(p.name, needle) || matches(p.description, needle),
    )
    .slice(0, PER_GROUP)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      origin: p.origin,
      updatedAt: p.updatedAt.toISOString(),
    }));

  return NextResponse.json({
    threads: threadHits,
    notes: noteHits,
    projects: projectHits,
    total: threadHits.length + noteHits.length + projectHits.length,
  });
}
