/**
 * Owner check for code-app Project rows (origin template|github|zip).
 * Studios (origin=workspace) are /api/workspaces, never these routes.
 */

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { CODE_PROJECT_ORIGINS } from "@/lib/code-project-origins";

export const CODE_PROJECT_NOT_FOUND = "Проект не найден";

export function codeProjectWhere(id: string, userId: string) {
  return { id, userId, origin: { in: [...CODE_PROJECT_ORIGINS] } };
}

export async function findOwnedCodeProject(id: string, userId: string) {
  return db.project.findFirst({ where: codeProjectWhere(id, userId) });
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
