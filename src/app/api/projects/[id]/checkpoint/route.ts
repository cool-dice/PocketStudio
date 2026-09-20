import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { codeProjectWhere } from "@/lib/project-api";
import {
  WorkspaceError,
  checkpointProject,
  projectRoot,
} from "@/lib/workspace";
import { readJsonBody } from "@/lib/json-body-limit";

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
    where: codeProjectWhere(id, session.sub),
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;
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
    // Git commit is the snapshot. File embeddings stay live on disk — no-op.
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
