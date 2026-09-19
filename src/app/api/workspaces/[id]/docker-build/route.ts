import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { ensureWorkspace } from "@/lib/workspace-api";
import {
  DOCKERFILE_MISSING_ERROR,
  DOCKER_DAEMON_MISSING_LOG,
  EMPTY_APP_BUILD_ERROR,
  dockerCliMissingLog,
  hasBuildableAppFiles,
  hasDockerfile,
} from "@/lib/docker-copy";
import { runDockerBuild, whichDocker } from "@/lib/docker-deploy";
import { listWorkspaceTree, projectRoot } from "@/lib/workspace";

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
  let files: { path: string; type: string }[] = [];
  try {
    files = (await listWorkspaceTree(root)).entries;
  } catch {
    files = [];
  }

  if (!hasBuildableAppFiles(files)) {
    return json(
      {
        status: "empty",
        log: EMPTY_APP_BUILD_ERROR,
        imageTag: null,
        published: false,
        error: EMPTY_APP_BUILD_ERROR,
      },
      400,
    );
  }
  if (!hasDockerfile(files)) {
    return json(
      {
        status: "empty",
        log: DOCKERFILE_MISSING_ERROR,
        imageTag: null,
        published: false,
        error: DOCKERFILE_MISSING_ERROR,
      },
      400,
    );
  }

  const docker = await whichDocker();
  if (docker === "no-cli") {
    return json(
      {
        status: "unavailable",
        log: dockerCliMissingLog(id, root),
        imageTag: null,
        published: false,
      },
      200,
    );
  }
  if (docker === "no-daemon") {
    return json(
      {
        status: "unavailable",
        log: DOCKER_DAEMON_MISSING_LOG,
        imageTag: null,
        published: false,
      },
      200,
    );
  }

  const tag = `pocketstudio/${id.slice(0, 12).toLowerCase()}:local`;
  const result = await runDockerBuild(root, tag);
  return json(
    {
      status: result.ok ? "built" : "failed",
      log: result.log || (result.ok ? "docker build завершился без лога" : "docker build не удался"),
      imageTag: result.ok ? tag : null,
      published: false,
    },
    200,
  );
}
