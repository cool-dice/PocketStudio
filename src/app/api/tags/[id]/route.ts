import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  TAG_COLOR_INVALID,
  TAG_NAME_TAKEN,
  TAG_NOT_FOUND,
  validateTagName,
} from "@/lib/notebook-taxonomy";
import { COLORS } from "@/lib/note-utils";

export const dynamic = "force-dynamic";

const patchTagColorSchema = z.object({
  color: z.enum(COLORS, TAG_COLOR_INVALID).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function tagDto(tag: {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  _count: { notes: number };
}) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    createdAt: tag.createdAt,
    noteCount: tag._count.notes,
  };
}

function ownNotesCount(userId: string) {
  return {
    _count: {
      select: { notes: { where: { note: { userId } } } },
    },
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

  const record = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
  if (!record) {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const existing = await db.tag.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: TAG_NOT_FOUND }, { status: 404 });
  }

  const data: { name?: string; color?: string } = {};
  if (Object.prototype.hasOwnProperty.call(record, "name")) {
    const nameParsed = validateTagName(record.name);
    if (!nameParsed.ok) {
      return NextResponse.json(
        { error: nameParsed.error, fields: { name: nameParsed.error } },
        { status: 400 },
      );
    }
    data.name = nameParsed.name;
  }

  const colorParsed = patchTagColorSchema.safeParse(record);
  if (!colorParsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of colorParsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }
  if (colorParsed.data.color !== undefined) data.color = colorParsed.data.color;

  try {
    const tag = await db.tag.update({
      where: { id },
      data,
      include: ownNotesCount(session.sub),
    });
    return NextResponse.json({ tag: tagDto(tag) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: TAG_NAME_TAKEN }, { status: 409 });
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

  const existing = await db.tag.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: TAG_NOT_FOUND }, { status: 404 });
  }

  await db.tag.deleteMany({ where: { id, userId: session.sub } });

  return NextResponse.json({ ok: true });
}
