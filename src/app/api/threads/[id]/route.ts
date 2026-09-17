import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

const patchThreadSchema = z.object({
  title: z.string().trim().min(1, "Заголовок не может быть пустым").max(120, "Заголовок не может превышать 120 символов").optional(),
  archived: z.boolean().optional(),
  mode: z.enum(["ask", "plan", "act", "review"], "Недопустимый режим диалога").optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function threadShape(thread: {
  id: string;
  title: string;
  mode: string;
  archived: boolean;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: thread.id,
    title: thread.title,
    mode: thread.mode,
    archived: thread.archived,
    projectId: thread.projectId,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export async function GET(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const thread = await db.thread.findFirst({
    where: { id, userId: session.sub },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, content: true, toolName: true, toolArgs: true, toolResult: true, createdAt: true },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  return NextResponse.json({
    thread: threadShape(thread),
    messages: thread.messages,
  });
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

  const parsed = patchThreadSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  const existing = await db.thread.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  const data: { title?: string; archived?: boolean; mode?: string } = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.archived !== undefined) data.archived = parsed.data.archived;
  if (parsed.data.mode !== undefined) data.mode = parsed.data.mode;

  const thread = await db.thread.update({
    where: { id },
    data,
  });

  return NextResponse.json({ thread: threadShape(thread) });
}

export async function DELETE(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const existing = await db.thread.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  await db.thread.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
