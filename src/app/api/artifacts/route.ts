import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { artifactDto } from "@/lib/workspace-shapes";

export const dynamic = "force-dynamic";

/* ── GET /api/artifacts — все артефакты пользователя (Библиотека) ──
 * Опциональные фильтры: ?type=image&projectId=... */

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const projectId = url.searchParams.get("projectId");

  const projects = await db.project.findMany({
    where: { userId: session.sub },
    select: { id: true },
  });
  const ids = projects.map((p) => p.id);
  if (ids.length === 0) {
    return NextResponse.json({ artifacts: [] });
  }

  const artifacts = await db.artifact.findMany({
    where: {
      projectId: projectId && ids.includes(projectId) ? projectId : { in: ids },
      ...(type ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return NextResponse.json({ artifacts: artifacts.map(artifactDto) });
}
