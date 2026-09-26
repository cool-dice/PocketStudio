import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { EMPTY_APP_BUILD_ERROR } from "@/lib/docker-copy";
import { dockerBuildWorkspace } from "@/lib/docker-deploy";
import { ensureCodeProject } from "@/lib/project-api";
import { projectRoot } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/docker-build — local `docker build` for a code
 * origin. Never a registry publish; no invented host.
 */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureCodeProject(req, id);
  if (!check.ok) return check.response;

  const project = await db.project.findFirst({
    where: { id, userId: check.userId },
    select: { id: true, rootPath: true },
  });
  if (!project) {
    return NextResponse.json(
      {
        status: "empty",
        log: EMPTY_APP_BUILD_ERROR,
        imageTag: null,
        published: false,
        error: "Проект не найден",
      },
      { status: 404 },
    );
  }

  const root = project.rootPath || projectRoot(project.id);
  const result = await dockerBuildWorkspace(project.id, root);
  const http = result.status === "empty" ? 400 : 200;
  return NextResponse.json(result, { status: http });
}
