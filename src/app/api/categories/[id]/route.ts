import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  CATEGORY_COLOR_INVALID,
  CATEGORY_ICON_INVALID,
  CATEGORY_NAME_EMPTY,
  CATEGORY_NAME_MAX,
  CATEGORY_NAME_TAKEN,
  CATEGORY_NAME_TOO_LONG,
  CATEGORY_NOT_FOUND,
} from "@/lib/notebook-taxonomy";
import { COLORS, ICONS } from "@/lib/note-utils";

export const dynamic = "force-dynamic";

const patchCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, CATEGORY_NAME_EMPTY)
    .max(CATEGORY_NAME_MAX, CATEGORY_NAME_TOO_LONG)
    .optional(),
  color: z.enum(COLORS, CATEGORY_COLOR_INVALID).optional(),
  icon: z.enum(ICONS, CATEGORY_ICON_INVALID).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function categoryResponse(category: {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: Date;
  _count: { notes: number };
}) {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    createdAt: category.createdAt,
    noteCount: category._count.notes,
  };
}

function ownNotesCount(userId: string) {
  return {
    _count: { select: { notes: { where: { userId } } } },
  } as const;
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const jsonRead = await readJsonBody(req);
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;

  const parsed = patchCategorySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  const existing = await db.category.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: CATEGORY_NOT_FOUND }, { status: 404 });
  }

  const data: { name?: string; color?: string; icon?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.color !== undefined) data.color = parsed.data.color;
  if (parsed.data.icon !== undefined) data.icon = parsed.data.icon;

  try {
    const category = await db.category.update({
      where: { id },
      data,
      include: ownNotesCount(session.sub),
    });

    return NextResponse.json({ category: categoryResponse(category) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: CATEGORY_NAME_TAKEN }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await db.category.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: CATEGORY_NOT_FOUND }, { status: 404 });
  }

  // Unlink only this user's notes, then delete the owned row. Never return
  // note payloads — a same-name category of another user stays untouched.
  await db.$transaction(async (tx) => {
    await tx.note.updateMany({
      where: { categoryId: id, userId: session.sub },
      data: { categoryId: null },
    });
    const foreign = await tx.note.count({
      where: { categoryId: id, userId: { not: session.sub } },
    });
    if (foreign === 0) {
      await tx.category.deleteMany({ where: { id, userId: session.sub } });
    }
  });

  return NextResponse.json({ ok: true });
}
