/**
 * Общие хелперы workspace-API (Фаза A): проверка владельца воркспейса
 * и стандартизированные ответы для переиспользования в routes.
 */

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { workspaceKindOf } from "@/lib/workspace-shapes";
import type { WorkspaceKind } from "@/lib/workspace-types";

export type Session = Awaited<ReturnType<typeof getUserFromRequest>>;

/** 401-ответ. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
}

/** Проверить, что воркспейс принадлежит пользователю. */
export async function ensureWorkspace(
  req: Request,
  projectId: string,
): Promise<
  | { ok: true; userId: string; kind: WorkspaceKind }
  | { ok: false; response: NextResponse }
> {
  const session = await getUserFromRequest(req);
  if (!session) {
    return { ok: false, response: unauthorized() };
  }
  const project = await db.project.findFirst({
    where: { id: projectId, userId: session.sub },
    select: { userId: true, type: true },
  });
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Воркспейс не найден" }, { status: 404 }),
    };
  }
  return { ok: true, userId: session.sub, kind: workspaceKindOf(project.type) };
}

/** Проверить, что сущность/документ/артефакт принадлежит пользователю. */
export async function ensureOwned<T extends { projectId: string }>(
  req: Request,
  row: T | null | undefined,
): Promise<
  | { ok: true; userId: string; row: T }
  | { ok: false; response: NextResponse }
> {
  const session = await getUserFromRequest(req);
  if (!session) {
    return { ok: false, response: unauthorized() };
  }
  if (!row) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Не найдено" }, { status: 404 }),
    };
  }
  const project = await db.project.findFirst({
    where: { id: row.projectId, userId: session.sub },
    select: { userId: true },
  });
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Не найдено" }, { status: 404 }),
    };
  }
  return { ok: true, userId: session.sub, row };
}
