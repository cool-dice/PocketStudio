import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { scheduleReindexProjectFiles } from "@/lib/rag";
import {
  WorkspaceError,
  projectRoot,
  restoreProjectCheckpoint,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

const schema = z.object({
  commit: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{6,40}$/i, "Некорректный хеш коммита"),
});

/* ── POST /api/projects/[id]/restore — reset THIS project's git to a commit ── */

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

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Укажите коммит" },
      { status: 400 },
    );
  }

  try {
    const restored = await restoreProjectCheckpoint(
      projectRoot(project.id),
      parsed.data.commit,
    );
    await db.project.update({
      where: { id: project.id },
      data: { updatedAt: new Date() },
    });
    // Working tree changed under git; file chunks stay stale until reindex.
    scheduleReindexProjectFiles(db, session.sub, project.id);
    return NextResponse.json({ restored });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[projects/restore] unexpected error:", err);
    return NextResponse.json(
      { error: "Не удалось восстановить чекпоинт" },
      { status: 500 },
    );
  }
}
