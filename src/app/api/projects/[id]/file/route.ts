import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  WorkspaceError,
  projectRoot,
  readWorkspaceFile,
  writeWorkspaceFile,
  deleteWorkspacePath,
} from "@/lib/workspace";
import { isDeletableRelPath } from "@/lib/rel-path";
import { removeFileChunks, scheduleIndexFile } from "@/lib/rag";
import { shouldSkipPath } from "@/lib/rag/skip";
import { oversizedJsonResponse, readJsonBody } from "@/lib/json-body-limit";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  path: z.string().trim().min(1, "Путь обязателен").max(400),
  content: z.string().max(256 * 1024, "Файл больше 256 КБ"),
});

function errorResponse(err: unknown) {
  if (err instanceof WorkspaceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[projects/file] unexpected error:", err);
  return NextResponse.json(
    { error: "Внутренняя ошибка сервера" },
    { status: 500 },
  );
}

/* ── GET /api/projects/[id]/file?path=… — read one file ── */

export async function GET(
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

  const filePath = new URL(req.url).searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Параметр path обязателен" }, { status: 400 });
  }

  try {
    const file = await readWorkspaceFile(projectRoot(project.id), filePath);
    return NextResponse.json(file);
  } catch (err) {
    return errorResponse(err);
  }
}

/* ── PUT /api/projects/[id]/file — save one file ── */

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = oversizedJsonResponse(req);
  if (blocked) return blocked;

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

  const jsonRead = await readJsonBody(req);
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value;
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "Ошибка валидации", fields }, { status: 400 });
  }

  try {
    const result = await writeWorkspaceFile(
      projectRoot(project.id),
      parsed.data.path,
      parsed.data.content,
    );
    await db.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    });
    if (!shouldSkipPath(result.path)) {
      scheduleIndexFile(db, {
        userId: session.sub,
        projectId: project.id,
        relPath: result.path,
        content: parsed.data.content,
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

/* ── DELETE /api/projects/[id]/file?path=… — remove file/dir + RAG chunks ── */

export async function DELETE(
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

  const filePath = new URL(req.url).searchParams.get("path");
  if (!filePath) {
    return NextResponse.json({ error: "Параметр path обязателен" }, { status: 400 });
  }
  if (!isDeletableRelPath(filePath)) {
    return NextResponse.json({ error: "Нельзя удалить корень проекта" }, { status: 400 });
  }

  try {
    const deleted = await deleteWorkspacePath(projectRoot(project.id), filePath);
    await db.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    });
    await removeFileChunks(db, session.sub, project.id, deleted.path);
    return NextResponse.json(deleted);
  } catch (err) {
    return errorResponse(err);
  }
}
