import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { noteWithCategory } from "@/lib/note-utils";
import { scheduleIndexNote, scheduleRemove } from "@/lib/rag";

export const dynamic = "force-dynamic";

const patchNoteSchema = z.object({
  favorite: z.boolean().optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
  remindAt: z.string().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8).optional(),
  rawText: z
    .string()
    .trim()
    .min(1, "Текст заметки не может быть пустым")
    .max(5000, "Текст заметки не может превышать 5000 символов")
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const note = await db.note.findFirst({
    where: { id, userId: session.sub },
    include: { category: true, tags: { include: { tag: true } } },
  });

  if (!note) {
    return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
  }

  return NextResponse.json({ note: noteWithCategory(note) });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const parsed = patchNoteSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  const existing = await db.note.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
  }

  // Validate category ownership when setting a new categoryId.
  if (typeof parsed.data.categoryId === "string") {
    const category = await db.category.findFirst({
      where: { id: parsed.data.categoryId, userId: session.sub },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
    }
  }

  const data: {
    favorite?: boolean;
    categoryId?: string | null;
    rawText?: string;
    remindAt?: Date | null;
    status?: string;
    positiveBlock?: null;
    negativeBlock?: null;
    finalBlock?: null;
    recommendations?: null;
    analysisRaw?: null;
    analyzedAt?: null;
    errorMessage?: null;
  } = {};
  if (parsed.data.favorite !== undefined) data.favorite = parsed.data.favorite;
  if (parsed.data.categoryId !== undefined) data.categoryId = parsed.data.categoryId;
  if (parsed.data.remindAt !== undefined) {
    if (!parsed.data.remindAt) {
      data.remindAt = null;
    } else {
      const at = new Date(parsed.data.remindAt);
      if (Number.isNaN(at.getTime())) {
        return NextResponse.json(
          { error: "Некорректная дата напоминания" },
          { status: 400 },
        );
      }
      data.remindAt = at;
    }
  }
  if (parsed.data.rawText !== undefined) {
    data.rawText = parsed.data.rawText;
    data.status = "pending";
    data.positiveBlock = null;
    data.negativeBlock = null;
    data.finalBlock = null;
    data.recommendations = null;
    data.analysisRaw = null;
    data.analyzedAt = null;
    data.errorMessage = null;
  }

  if (parsed.data.tags) {
    const names = parsed.data.tags
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean)
      .slice(0, 8);
    await db.noteTag.deleteMany({ where: { noteId: id } });
    for (const name of names) {
      const tag =
        (await db.tag.findFirst({ where: { userId: session.sub, name } })) ??
        (await db.tag.create({
          data: { userId: session.sub, name, color: "stone" },
        }));
      await db.noteTag.create({ data: { noteId: id, tagId: tag.id } });
    }
  }

  const note = await db.note.update({
    where: { id },
    data,
    include: { category: true, tags: { include: { tag: true } } },
  });

  scheduleIndexNote(db, note.id);

  return NextResponse.json({ note: noteWithCategory(note) });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await db.note.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });
  }

  await db.note.delete({ where: { id } });
  scheduleRemove(db, session.sub, "note", id);

  return NextResponse.json({ ok: true });
}
