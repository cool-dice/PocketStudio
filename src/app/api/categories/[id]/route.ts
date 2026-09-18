import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { COLORS, ICONS } from "@/lib/note-utils";

export const dynamic = "force-dynamic";

const patchCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Название категории не может быть пустым")
    .max(40, "Название категории не может превышать 40 символов")
    .optional(),
  color: z.enum(COLORS, "Недопустимый цвет").optional(),
  icon: z.enum(ICONS, "Недопустимая иконка").optional(),
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
    return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
  }

  const data: { name?: string; color?: string; icon?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.color !== undefined) data.color = parsed.data.color;
  if (parsed.data.icon !== undefined) data.icon = parsed.data.icon;

  try {
    const category = await db.category.update({
      where: { id },
      data,
      include: { _count: { select: { notes: true } } },
    });

    return NextResponse.json({ category: categoryResponse(category) });
  } catch (e) {
    // @@unique([userId, name]) — rename to an existing name.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Категория с таким названием уже существует" },
        { status: 409 }
      );
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
    return NextResponse.json({ error: "Категория не найдена" }, { status: 404 });
  }

  // Notes keep a null categoryId (onDelete: SetNull in the schema).
  await db.category.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
