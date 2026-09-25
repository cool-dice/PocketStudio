/**
 * Resolve which studio a tool should target.
 *
 * Same contract as RAG `resolveRetrieveScope`:
 *   workspace thread (ctx.projectId set) → stay in that studio, ignore
 *   a model-supplied foreign id/name;
 *   global chat → explicit id, then name (exact / startsWith / includes),
 *   then unbound.
 */

import { throwIfAborted } from "./abort-flag";

export interface WorkspaceRow {
  id: string;
  name: string;
  type: string;
}

export interface WorkspaceLookupDb {
  project: {
    findFirst: (args: any) => Promise<WorkspaceRow | null>;
    findMany: (args: any) => Promise<WorkspaceRow[]>;
  };
}

export interface ResolveWorkspaceCtx {
  projectId?: string | null;
  signal?: AbortSignal;
}

export type ResolveWorkspaceResult = WorkspaceRow | { error: string } | null;

export function pickString(
  args: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function matchWorkspaceByName<T extends { name: string }>(
  rows: T[],
  name: string,
): T | undefined {
  const lower = name.toLowerCase();
  return (
    rows.find((p) => p.name.toLowerCase() === lower) ??
    rows.find((p) => p.name.toLowerCase().startsWith(lower)) ??
    rows.find((p) => p.name.toLowerCase().includes(lower))
  );
}

export type WorkspaceTarget =
  | { kind: "thread" }
  | { kind: "id"; id: string }
  | { kind: "name"; name: string }
  | { kind: "none" };

/**
 * Pure targeting: a bound workspace thread never retargets another studio.
 */
export function pickWorkspaceTarget(
  threadProjectId: string | null | undefined,
  requestedId: string | null,
  requestedName: string | null,
): WorkspaceTarget {
  if (threadProjectId) return { kind: "thread" };
  if (requestedId) return { kind: "id", id: requestedId };
  if (requestedName) return { kind: "name", name: requestedName };
  return { kind: "none" };
}

const SELECT = { id: true, name: true, type: true } as const;
const MISSING_ID = "Воркспейс с таким id не найден";
const MISSING_CTX = "Воркспейс текущего диалога не найден";

function missingName(name: string): string {
  return `Воркспейс «${name}» не найден — проверьте название или передайте workspaceId`;
}

const NEED_WORKSPACE =
  "Укажите воркспейс: откройте чат внутри воркспейса или передайте workspaceId / workspaceName";

async function loadOwned(
  db: WorkspaceLookupDb,
  userId: string,
  id: string,
): Promise<WorkspaceRow | null> {
  return db.project.findFirst({
    where: { id, userId },
    select: SELECT,
  });
}

export async function resolveWorkspace(
  db: WorkspaceLookupDb,
  userId: string,
  args: Record<string, unknown>,
  ctx?: ResolveWorkspaceCtx,
  opts?: { required?: boolean },
): Promise<ResolveWorkspaceResult> {
  throwIfAborted(ctx?.signal);
  const required = opts?.required !== false;
  const requestedId = pickString(args, ["workspaceId", "projectId"]);
  const requestedName = pickString(args, ["workspaceName", "projectName"]);
  const target = pickWorkspaceTarget(
    ctx?.projectId,
    requestedId,
    requestedName,
  );

  if (target.kind === "thread") {
    const byCtx = await loadOwned(db, userId, ctx!.projectId!);
    if (byCtx) return byCtx;
    return { error: MISSING_CTX };
  }

  if (target.kind === "id") {
    const byId = await loadOwned(db, userId, target.id);
    if (byId) return byId;
    return { error: MISSING_ID };
  }

  if (target.kind === "name") {
    const all = await db.project.findMany({
      where: { userId },
      select: SELECT,
      orderBy: { updatedAt: "desc" },
    });
    const found = matchWorkspaceByName(all, target.name);
    if (found) return found;
    return { error: missingName(target.name) };
  }

  if (!required) return null;
  return { error: NEED_WORKSPACE };
}
