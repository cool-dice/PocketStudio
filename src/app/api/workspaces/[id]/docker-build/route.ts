import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import { EMPTY_APP_BUILD_ERROR } from "@/lib/docker-copy";
import { dockerBuildWorkspace } from "@/lib/docker-deploy";
import { projectRoot } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

function json(
  body: {
    status: "empty" | "unavailable" | "failed" | "built";
    log: string;
    imageTag: string | null;
    published: false;
    error?: string;
  },
  status: number,
) {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const check = await ensureWorkspace(req, id);
  if (!check.ok) return check.response;

  const project = await db.project.findFirst({
    where: { id, userId: check.userId },
    select: { id: true, rootPath: true },
  });
  if (!project) {
    return json(
      {
        status: "empty",
        log: EMPTY_APP_BUILD_ERROR,
        imageTag: null,
        published: false,
        error: "Воркспейс не найден",
      },
      404,
    );
  }

  const root = project.rootPath || projectRoot(project.id);
  const result = await dockerBuildWorkspace(project.id, root);
  const http =
    result.status === "empty" && result.error === EMPTY_APP_BUILD_ERROR
      ? 400
      : result.status === "empty"
        ? 400
        : 200;
  return json(result, http);
}
