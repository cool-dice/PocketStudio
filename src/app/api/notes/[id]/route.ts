import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { noteWithCategory } from "@/lib/note-utils";

export const dynamic = "force-dynamic";

const patchNoteSchema = z.object({
  favorite: z.boolean().optional(),
  categoryId: z.string().trim().min(1).nullable().optional(),
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
    include: { category: true },
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
    // Editing the text invalidates the old analysis → re-queue (Stage 2).
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

  const note = await db.note.update({
    where: { id },
    data,
    include: { category: true },
  });

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

  return NextResponse.json({ ok: true });
}
