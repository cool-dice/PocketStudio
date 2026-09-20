import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { requireAdmin } from "@/lib/admin";
import { getUserFromRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { reindexAllUsers, reindexUserData } from "@/lib/rag";
import { EMBEDDING_DIM_MISMATCH_MESSAGE, UNCONFIGURED_EMBEDDINGS_MESSAGE } from "@/lib/rag/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  all: z.boolean().optional(),
  projectId: z.string().trim().min(1).optional(),
});

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = bodySchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const projectId = parsed.data.projectId ?? null;
  if (projectId) {
    const owned = await db.project.findFirst({
      where: { id: projectId, userId: session.sub },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
    }
  }

  try {
    if (parsed.data.all) {
      const guard = await requireAdmin(req);
      if (!guard.ok) return guard.response;
      const result = await reindexAllUsers(db, session.sub);
      return NextResponse.json({
        ok: true,
        all: true,
        users: result.users,
        message: `Переиндексированы данные ${result.users} пользователей.`,
      });
    }

    const report = await reindexUserData(db, {
      actorUserId: session.sub,
      targetUserId: session.sub,
      projectId,
      requireEmbeddings: true,
    });
    const total =
      report.notes +
      report.sections +
      report.entities +
      report.artifacts +
      report.skills +
      report.findings +
      report.files +
      report.threads;
    return NextResponse.json({
      ok: true,
      report,
      message: projectId
        ? `Воркспейс переиндексирован (${total} источников).`
        : `Ваш канон переиндексирован (${total} источников).`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Не удалось переиндексировать";
    const status =
      msg === UNCONFIGURED_EMBEDDINGS_MESSAGE || msg === EMBEDDING_DIM_MISMATCH_MESSAGE
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
