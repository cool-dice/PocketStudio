import { spawn } from "node:child_process";

import {
  DOCKERFILE_MISSING_ERROR,
  DOCKER_DAEMON_MISSING_LOG,
  EMPTY_APP_BUILD_ERROR,
  dockerCliMissingLog,
  hasBuildableAppFiles,
  hasDockerfile,
} from "./docker-copy";
import { listWorkspaceTree } from "./workspace";

export type DockerPresence = "ok" | "no-cli" | "no-daemon";

export type DockerBuildStatus = "empty" | "unavailable" | "failed" | "built";

export interface DockerBuildResult {
  status: DockerBuildStatus;
  log: string;
  imageTag: string | null;
  published: false;
  error?: string;
}

function looksLikeMissingDaemon(text: string): boolean {
  return /cannot connect|daemon|Is the docker daemon running|pipe/i.test(text);
}

/** Probe docker CLI + daemon. Never invent a healthy daemon. */
export function whichDocker(): Promise<DockerPresence> {
  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      ["version", "--format", "{{.Server.Version}}"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("error", () => resolve("no-cli"));
    child.on("close", (code) => {
      if (code === 0 && out.trim()) {
        resolve("ok");
        return;
      }
      if (looksLikeMissingDaemon(`${out}\n${err}`)) {
        resolve("no-daemon");
        return;
      }
      resolve(code === null ? "no-cli" : "no-daemon");
    });
  });
}

export function runDockerBuild(
  root: string,
  tag: string,
): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolve) => {
    const child = spawn("docker", ["build", "-t", tag, "."], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    child.stdout.on("data", (chunk) => {
      buf += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      buf += String(chunk);
    });
    child.on("error", (error) => resolve({ ok: false, log: error.message }));
    child.on("close", (code) =>
      resolve({ ok: code === 0, log: buf.slice(-8_000) }),
    );
  });
}

/**
 * Same docker-build path as POST /api/workspaces/[id]/docker-build.
 * Empty trees are never «built». Missing CLI/daemon is «unavailable».
 * published is always false — local build is not a registry push.
 */
export async function dockerBuildWorkspace(
  projectId: string,
  root: string,
): Promise<DockerBuildResult> {
  let files: { path: string; type: string }[] = [];
  try {
    files = (await listWorkspaceTree(root)).entries;
  } catch {
    files = [];
  }

  if (!hasBuildableAppFiles(files)) {
    return {
      status: "empty",
      log: EMPTY_APP_BUILD_ERROR,
      imageTag: null,
      published: false,
      error: EMPTY_APP_BUILD_ERROR,
    };
  }
  if (!hasDockerfile(files)) {
    return {
      status: "empty",
      log: DOCKERFILE_MISSING_ERROR,
      imageTag: null,
      published: false,
      error: DOCKERFILE_MISSING_ERROR,
    };
  }

  const docker = await whichDocker();
  if (docker === "no-cli") {
    return {
      status: "unavailable",
      log: dockerCliMissingLog(projectId, root),
      imageTag: null,
      published: false,
    };
  }
  if (docker === "no-daemon") {
    return {
      status: "unavailable",
      log: DOCKER_DAEMON_MISSING_LOG,
      imageTag: null,
      published: false,
    };
  }

  const tag = `pocketstudio/${projectId.slice(0, 12).toLowerCase()}:local`;
  const result = await runDockerBuild(root, tag);
  return {
    status: result.ok ? "built" : "failed",
    log:
      result.log ||
      (result.ok
        ? "docker build завершился без лога"
        : "docker build не удался"),
    imageTag: result.ok ? tag : null,
    published: false,
  };
}
