import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { readJsonBody } from "@/lib/json-body-limit";
import { generateWorkspaceDockerfile } from "@/lib/docker-file";
import { ensureCodeProject } from "@/lib/project-api";
import { projectRoot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  overwrite: z.boolean().optional(),
});

/**
 * POST /api/projects/[id]/dockerfile — same generator as the workspace
 * route, but only for code origins. Not a publish; no host URL.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const check = await ensureCodeProject(req, id);
  if (!check.ok) return check.response;

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body = bodySchema.safeParse(jsonRead.value);

  const project = await db.project.findFirst({
    where: { id, userId: check.userId },
    select: { id: true, name: true, rootPath: true },
  });
  if (!project?.rootPath) {
    return NextResponse.json(
      { error: "У код-проекта нет файлов на диске" },
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
    project: { id: project.id, name: project.name },
    published: false,
    imageTag: null,
    status: result.status,
    empty: result.empty,
    hint: result.hint,
  });
}
