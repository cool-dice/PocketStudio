import { spawn } from "node:child_process";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { projectRoot } from "@/lib/workspace";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

function whichDocker(): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("docker", ["version", "--format", "{{.Server.Version}}"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => {
      out += String(d);
    });
    child.stderr.on("data", (d) => {
      err += String(d);
    });
    child.on("error", () => resolve(null));
    child.on("close", (code) => {
      if (code === 0 && out.trim()) resolve(out.trim());
      else resolve(err.includes("Cannot connect") ? "no-daemon" : null);
    });
  });
}

export async function POST(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, userId: session.sub },
  });
  if (!project) {
    return NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 });
  }
  const root = project.rootPath || projectRoot(project.id);

  const docker = await whichDocker();
  if (!docker) {
    return NextResponse.json({
      status: "unavailable",
      log: "docker CLI не найден в PATH. Соберите образ локально:\n  docker build -t pocketstudio/" +
        id.slice(0, 8) +
        " " +
        root,
      imageTag: null,
    });
  }
  if (docker === "no-daemon") {
    return NextResponse.json({
      status: "unavailable",
      log: "Docker CLI есть, но демон не запущен. Запустите Docker Desktop / dockerd и повторите.",
      imageTag: null,
    });
  }

  const tag = `pocketstudio/${id.slice(0, 12).toLowerCase()}:local`;
  const log = await new Promise<string>((resolve) => {
    const child = spawn("docker", ["build", "-t", tag, "."], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buf = "";
    child.stdout.on("data", (d) => {
      buf += String(d);
    });
    child.stderr.on("data", (d) => {
      buf += String(d);
    });
    child.on("error", (err) => resolve(err.message));
    child.on("close", () => resolve(buf.slice(-8_000)));
  });

  const ok = /Successfully tagged|naming to/i.test(log);
  return NextResponse.json({
    status: ok ? "built" : "failed",
    log,
    imageTag: ok ? tag : null,
  });
}
