import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { codeProjectWhere } from "@/lib/project-api";
import { listProjectCommits, projectRoot } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/* ── GET /api/projects/[id]/commits?limit=50 — checkpoint history ── */

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const project = await db.project.findFirst({
    where: codeProjectWhere(id, session.sub),
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 50;

  const commits = await listProjectCommits(projectRoot(project.id), limit);
  return NextResponse.json({ commits });
}
