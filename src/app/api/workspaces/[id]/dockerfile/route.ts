import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { generateWorkspaceDockerfile } from "@/lib/docker-file";
import { projectRoot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/**
 * POST /api/workspaces/[id]/dockerfile — генератор Dockerfile (Фаза D).
 *
 * Анализирует реальные файлы воркспейса (package.json, фреймворк-маркеры)
 * и пишет Dockerfile + .dockerignore в корень проекта на диск.
 * Генератор не публикует образ и не помечает сборку успешной.
 */

const bodySchema = z.object({
  overwrite: z.boolean().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;
  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body = bodySchema.safeParse(jsonRead.value);

  const project = await db.project.findFirst({
    where: { id, userId: check.userId },
    select: { id: true, name: true, rootPath: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }
  if (!project.rootPath) {
    return NextResponse.json(
      {
        error:
          "У контентного воркспейса нет файлов на диске — Dockerfile генерируется для воркспейсов с кодом",
      },
      { status: 400 },
    );
  }

  const result = await generateWorkspaceDockerfile(
    projectRoot(project.id),
    Boolean(body.data?.overwrite),
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.conflict ? 409 : 400 },
    );
  }

  return NextResponse.json({
    kind: result.kind,
    dockerfile: result.dockerfile,
    dockerignore: result.dockerignore,
    workspace: { id: project.id, name: project.name },
    published: false,
    imageTag: null,
    status: result.status,
    empty: result.empty,
    hint: result.hint,
  });
}
