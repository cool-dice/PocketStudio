import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { codeProjectWhere } from "@/lib/project-api";
import {
  WorkspaceError,
  ensureCodeWorkspace,
  hasUncommittedChanges,
  listWorkspaceTree,
  projectRoot,
} from "@/lib/workspace";

export const dynamic = "force-dynamic";

/* ── GET /api/projects/[id]/tree — flat file listing ── */

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

  try {
    if (project.type === "app") {
      const root = await ensureCodeWorkspace(project.id);
      if (!project.rootPath) {
        await db.project.update({
          where: { id: project.id },
          data: { rootPath: root },
        });
      }
    }
    const root = projectRoot(project.id);
    const [{ entries, truncated }, dirty] = await Promise.all([
      listWorkspaceTree(root),
      hasUncommittedChanges(root),
    ]);
    return NextResponse.json({ tree: entries, truncated, dirty });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Не удалось прочитать файлы проекта" },
      { status: 500 },
    );
  }
}
