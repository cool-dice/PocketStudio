import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { workspaceCounts, workspaceDto } from "@/lib/workspace-shapes";
import {
  createTypedWorkspace,
  validateWorkspaceCreate,
} from "@/lib/create-typed-workspace";

export const dynamic = "force-dynamic";

/* ── GET /api/workspaces — список воркспейсов ── */

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const url = new URL(req.url);
  const projects = await db.project.findMany({
    where: {
      userId: session.sub,
      origin: "workspace",
      ...(url.searchParams.get("archived") === "1"
        ? { archived: true }
        : { archived: false }),
    },
    orderBy: { updatedAt: "desc" },
  });

  const ids = projects.map((p) => p.id);
  const threadMax =
    ids.length === 0
      ? []
      : await db.thread.groupBy({
          by: ["projectId"],
          where: { projectId: { in: ids } },
          _max: { updatedAt: true },
        });
  const threadRecency = new Map(
    threadMax
      .filter((row): row is typeof row & { projectId: string } => row.projectId != null)
      .map((row) => [row.projectId, row._max.updatedAt?.getTime() ?? 0]),
  );
  projects.sort((a, b) => {
    const aT = Math.max(a.updatedAt.getTime(), threadRecency.get(a.id) ?? 0);
    const bT = Math.max(b.updatedAt.getTime(), threadRecency.get(b.id) ?? 0);
    return bT - aT;
  });

  const shaped = await Promise.all(
    projects.map(async (p) => workspaceDto(p, await workspaceCounts(p.id))),
  );

  return NextResponse.json({ workspaces: shaped });
}

/* ── POST /api/workspaces — создать воркспейс ── */

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body =
    jsonRead.value && typeof jsonRead.value === "object"
      ? (jsonRead.value as Record<string, unknown>)
      : {};
  const parsed = validateWorkspaceCreate({
    name: body.name,
    type: body.type,
    description: body.description,
  });
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const project = await createTypedWorkspace(db, session.sub, parsed);
  return NextResponse.json(
    { workspace: workspaceDto(project, await workspaceCounts(project.id)) },
    { status: 201 },
  );
}
