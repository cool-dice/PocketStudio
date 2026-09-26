import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/workspace-api";
import { liveArtifactDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

/* ── GET /api/artifacts — все артефакты пользователя (Библиотека) ──
 * Опциональные фильтры: ?type=image&projectId=...
 * Чужой projectId — 404, без подмены выборки своими артефактами. */

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const projectId = url.searchParams.get("projectId");

  let projectFilter: string | { in: string[] };
  if (projectId) {
    const check = await ensureWorkspace(req, projectId);
    if (!check.ok) return check.response;
    projectFilter = projectId;
  } else {
    const projects = await db.project.findMany({
      where: { userId: session.sub, origin: "workspace" },
      select: { id: true },
    });
    const ids = projects.map((p) => p.id);
    if (ids.length === 0) {
      return NextResponse.json({ artifacts: [] });
    }
    projectFilter = { in: ids };
  }

  const artifacts = await db.artifact.findMany({
    where: {
      projectId: projectFilter,
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json({
    artifacts: artifacts.map((a) => liveArtifactDto(a)),
  });
}
