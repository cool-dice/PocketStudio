import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  WorkspaceError,
  checkpointProject,
  projectRoot,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

const schema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Сообщение чекпоинта не может быть пустым")
    .max(200, "Сообщение не может превышать 200 символов"),
});

/* ── POST /api/projects/[id]/checkpoint — commit all current changes ── */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: session.sub },
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ошибка валидации" },
      { status: 400 },
    );
  }

  try {
    const checkpoint = await checkpointProject(
      projectRoot(project.id),
      parsed.data.message,
    );
    await db.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    });
    return NextResponse.json({ checkpoint });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[projects/checkpoint] unexpected error:", err);
    return NextResponse.json(
      { error: "Не удалось создать чекпоинт" },
      { status: 500 },
    );
  }
}
