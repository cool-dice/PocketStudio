/**
 * Owner checks for Project rows.
 * GET/PATCH/DELETE /api/projects and Dockerfile stay code-origin only.
 * Tree/file/git routes also serve app-type studios (disk on that /w/{id}).
 */

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { CODE_PROJECT_ORIGINS } from "@/lib/code-project-origins";

export const CODE_PROJECT_NOT_FOUND = "Проект не найден";

export function codeProjectWhere(id: string, userId: string) {
  return { id, userId, origin: { in: [...CODE_PROJECT_ORIGINS] } };
}

/** Next.js code apps, or an app-type studio with files on disk. */
export function diskFilesWhere(id: string, userId: string) {
  return {
    id,
    userId,
    OR: [
      { origin: { in: [...CODE_PROJECT_ORIGINS] } },
      { origin: "workspace", type: "app" },
    ],
  };
}

export async function findOwnedCodeProject(id: string, userId: string) {
  return db.project.findFirst({ where: codeProjectWhere(id, userId) });
}

export async function findOwnedDiskProject(id: string, userId: string) {
  return db.project.findFirst({ where: diskFilesWhere(id, userId) });
}

export async function ensureCodeProject(
  req: Request,
  projectId: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getUserFromRequest(req);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 },
      ),
    };
  }
  const project = await findOwnedCodeProject(projectId, session.sub);
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: CODE_PROJECT_NOT_FOUND },
        { status: 404 },
      ),
    };
  }
  return { ok: true, userId: session.sub };
}
