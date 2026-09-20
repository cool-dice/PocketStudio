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
  validateCategoryName,
} from "@/lib/notebook-taxonomy";
import { COLORS, ICONS } from "@/lib/note-utils";

export const dynamic = "force-dynamic";

const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, CATEGORY_NAME_EMPTY)
    .max(CATEGORY_NAME_MAX, CATEGORY_NAME_TOO_LONG),
  color: z.enum(COLORS, CATEGORY_COLOR_INVALID).optional(),
  icon: z.enum(ICONS, CATEGORY_ICON_INVALID).optional(),
});

function categoryDto(category: {
  id: string;
  name: string;
  color: string;
  icon: string;
  _count: { notes: number };
}) {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    noteCount: category._count.notes,
  };
}

function ownNotesCount(userId: string) {
  return {
    _count: { select: { notes: { where: { userId } } } },
  } as const;
}

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const categories = await db.category.findMany({
    where: { userId: session.sub },
    orderBy: { name: "asc" },
    include: ownNotesCount(session.sub),
  });

  return NextResponse.json({
    categories: categories.map(categoryDto),
  });
}

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const jsonRead = await readJsonBody(req);
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;

  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    const nameCheck = validateCategoryName(
      body && typeof body === "object" && "name" in body
        ? (body as { name: unknown }).name
        : "",
    );
    return NextResponse.json(
      {
        error: nameCheck.ok ? "Ошибка валидации" : nameCheck.error,
        fields,
      },
      { status: 400 },
    );
  }

  try {
    const category = await db.category.create({
      data: {
        userId: session.sub,
        name: parsed.data.name,
        color: parsed.data.color ?? "stone",
        icon: parsed.data.icon ?? "lightbulb",
      },
      include: ownNotesCount(session.sub),
    });
    return NextResponse.json({ category: categoryDto(category) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: CATEGORY_NAME_TAKEN }, { status: 409 });
    }
    throw e;
  }
}
