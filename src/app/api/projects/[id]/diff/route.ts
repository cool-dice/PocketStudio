import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { codeProjectWhere } from "@/lib/project-api";
import { commitDiff, projectRoot, WorkspaceError } from "@/lib/workspace";

export const dynamic = "force-dynamic";

/* ── GET /api/projects/[id]/diff?commit=<hash> — diff of one checkpoint ── */

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

  const commit = new URL(req.url).searchParams.get("commit")?.trim() ?? "";
  if (!commit) {
    return NextResponse.json(
      { error: "Укажите параметр commit" },
      { status: 400 },
    );
  }

  try {
    const diff = await commitDiff(projectRoot(project.id), commit);
    return NextResponse.json({ diff });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Не удалось получить diff" },
      { status: 500 },
    );
  }
}
