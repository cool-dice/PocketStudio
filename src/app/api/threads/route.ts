import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { readJsonBody } from "@/lib/json-body-limit";

export const dynamic = "force-dynamic";

const createThreadSchema = z.object({
  title: z.string().trim().max(120, "Заголовок не может превышать 120 символов").optional(),
  projectId: z.string().trim().min(1).optional(),
  mode: z.enum(["ask", "plan", "act", "review"], "Недопустимый режим диалога").optional(),
});

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const url = new URL(req.url);
  const archived = url.searchParams.get("archived") === "1";

  const threads = await db.thread.findMany({
    where: { userId: session.sub, archived },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        // Last few messages: the newest USER/ASSISTANT entry becomes the
        // sidebar preview (tool JSON must never leak into the sidebar).
        take: 5,
        orderBy: { createdAt: "desc" },
        where: { role: { in: ["user", "assistant"] } },
        select: { content: true, role: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      mode: t.mode,
      archived: t.archived,
      projectId: t.projectId,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      lastMessage: t.messages[0] ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;

  const parsed = createThreadSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  const title = parsed.data.title && parsed.data.title.length > 0
    ? parsed.data.title
    : "Новый диалог";
  const mode = parsed.data.mode ?? "ask";

  // Validate project ownership if provided.
  let projectId: string | undefined;
  if (parsed.data.projectId) {
    const project = await db.project.findFirst({
      where: { id: parsed.data.projectId, userId: session.sub },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
    }
    projectId = project.id;
  }

  const thread = await db.thread.create({
    data: {
      userId: session.sub,
      title,
      mode,
      projectId: projectId ?? null,
    },
  });

  return NextResponse.json(
    {
      thread: {
        id: thread.id,
        title: thread.title,
        mode: thread.mode,
        archived: thread.archived,
        projectId: thread.projectId,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      },
    },
    { status: 201 }
  );
}
