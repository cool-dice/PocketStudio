import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { noteWithCategory } from "@/lib/note-utils";
import { scheduleIndexNote } from "@/lib/rag";
import { persistableTranscription } from "@/lib/voice-copy";

export const dynamic = "force-dynamic";

const createNoteSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Текст заметки не может быть пустым")
    .max(5000, "Текст заметки не может превышать 5000 символов"),
  /** Исходная ASR-расшифровка (голос). Typed notes omit this → null. */
  transcription: z
    .string()
    .max(5000, "Расшифровка не может превышать 5000 символов")
    .nullish(),
  categoryId: z.string().trim().min(1).optional(),
  /** Привязать к воркспейсу (NoteLink kind=context). */
  projectId: z.string().trim().min(1).optional(),
});

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId")?.trim() || null;
  const favorite = url.searchParams.get("favorite") === "1";
  const reminders = url.searchParams.get("reminders") === "1";
  const due = url.searchParams.get("due") === "1";
  const tagId = url.searchParams.get("tagId")?.trim() || null;
  const projectId = url.searchParams.get("projectId")?.trim() || null;
  // Case-insensitive substring search on rawText.
  const q = url.searchParams.get("q")?.trim().toLowerCase() || null;

  let page = 1;
  let limit = 20;
  const pageRaw = url.searchParams.get("page");
  if (pageRaw !== null && pageRaw !== "") {
    const n = Number(pageRaw);
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json(
        { error: "Параметр page должен быть целым числом не меньше 1" },
        { status: 400 }
      );
    }
    page = n;
  }
  const limitRaw = url.searchParams.get("limit");
  if (limitRaw !== null && limitRaw !== "") {
    const n = Number(limitRaw);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return NextResponse.json(
        { error: "Параметр limit должен быть целым числом от 1 до 50" },
        { status: 400 }
      );
    }
    limit = n;
  }

  const where: Prisma.NoteWhereInput = { userId: session.sub };
  if (categoryId) where.categoryId = categoryId;
  if (favorite) where.favorite = true;
  if (due) where.remindAt = { not: null, lte: new Date() };
  else if (reminders) where.remindAt = { not: null };
  if (tagId) where.tags = { some: { tagId } };

  if (projectId) {
    const owned = await db.project.findFirst({
      where: { id: projectId, userId: session.sub },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
    }
    const links = await db.noteLink.findMany({
      where: { projectId },
      select: { noteId: true },
    });
    if (links.length === 0) {
      return NextResponse.json({ notes: [], total: 0, hasMore: false });
    }
    where.id = { in: links.map((l) => l.noteId) };
  }

  if (q) {
    // Unicode-safe case-insensitive matching in JS (covers Cyrillic;
    // Postgres ILIKE depends on the cluster locale).
    const candidates = await db.note.findMany({
      where,
      select: { id: true, rawText: true },
    });
    const matchedIds = candidates
      .filter((n) => (n.rawText ?? "").toLowerCase().includes(q))
      .map((n) => n.id);

    if (matchedIds.length === 0) {
      return NextResponse.json({ notes: [], total: 0, hasMore: false });
    }
    where.id = { in: matchedIds };
  }

  const [total, notes] = await Promise.all([
    db.note.count({ where }),
    db.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { category: true, tags: { include: { tag: true } } },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    notes: notes.map((n) => noteWithCategory(n)),
    total,
    hasMore: page * limit < total,
  });
}

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  // Validate category ownership when provided.
  let category: { id: string; name: string; color: string; icon: string } | null = null;
  if (parsed.data.categoryId) {
    category = await db.category.findFirst({
      where: { id: parsed.data.categoryId, userId: session.sub },
      select: { id: true, name: true, color: true, icon: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }
  }

  let projectId: string | null = null;
  if (parsed.data.projectId) {
    const project = await db.project.findFirst({
      where: { id: parsed.data.projectId, userId: session.sub },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
    }
    projectId = project.id;
  }

  const note = await db.note.create({
    data: {
      userId: session.sub,
      rawText: parsed.data.text,
      transcription: persistableTranscription(parsed.data.transcription),
      status: "pending",
      categoryId: category?.id ?? undefined,
    },
  });

  if (projectId) {
    await db.noteLink.create({
      data: { noteId: note.id, projectId, kind: "context" },
    });
  }

  scheduleIndexNote(db, note.id);

  return NextResponse.json(
    { note: noteWithCategory({ ...note, category }) },
    { status: 201 }
  );
}
