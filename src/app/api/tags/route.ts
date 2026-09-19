import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  TAG_COLOR_INVALID,
  TAG_NAME_TAKEN,
  validateTagName,
} from "@/lib/notebook-taxonomy";
import { COLORS } from "@/lib/note-utils";

export const dynamic = "force-dynamic";

const createTagColorSchema = z.object({
  color: z.enum(COLORS, TAG_COLOR_INVALID).optional(),
});

function tagDto(tag: {
  id: string;
  name: string;
  color: string;
  _count: { notes: number };
}) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
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

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const tags = await db.tag.findMany({
    where: { userId: session.sub },
    include: ownNotesCount(session.sub),
    orderBy: { name: "asc" },
  });
  return NextResponse.json({
    tags: tags.map(tagDto),
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

  const record = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
  if (!record) {
    return NextResponse.json({ error: "Некорректный JSON в запросе" }, { status: 400 });
  }

  const nameParsed = validateTagName(record.name);
  if (!nameParsed.ok) {
    return NextResponse.json(
      { error: nameParsed.error, fields: { name: nameParsed.error } },
      { status: 400 },
    );
  }

  const colorParsed = createTagColorSchema.safeParse(record);
  if (!colorParsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of colorParsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  try {
    const tag = await db.tag.create({
      data: {
        userId: session.sub,
        name: nameParsed.name,
        color: colorParsed.data.color ?? "stone",
      },
      include: ownNotesCount(session.sub),
    });
    return NextResponse.json({ tag: tagDto(tag) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: TAG_NAME_TAKEN }, { status: 409 });
    }
    throw e;
  }
}
