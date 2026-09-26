import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/threads/[id]/tasks — the thread's plan checklist (order asc). */
export async function GET(req: Request, ctx: RouteContext) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await ctx.params;

  const thread = await db.thread.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!thread) {
    return NextResponse.json({ error: "Диалог не найден" }, { status: 404 });
  }

  const tasks = await db.task.findMany({
    where: { threadId: id },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      text: true,
      done: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ tasks });
}
