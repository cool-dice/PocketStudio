/**
 * RAG isolation contract.
 *
 * global  (main chat, Thread.projectId == null):
 *   WHERE userId = me — any projectId including null
 * workspace (Thread.projectId == X):
 *   WHERE userId = me AND projectId = X
 *
 * NEVER cross userId.
 * NEVER return another workspace’s chunks in workspace scope.
 */

import type { RagChunkRow, RagScope, RagScopeKind } from "./types";

export function ragScopeFromThread(
  userId: string,
  threadProjectId: string | null | undefined,
): RagScope {
  if (threadProjectId) {
    return { kind: "workspace", userId, projectId: threadProjectId };
  }
  return { kind: "global", userId, projectId: null };
}

/**
 * Workspace threads ignore a model-supplied workspaceId that would widen
 * or retarget the scope. Global chat may narrow to one owned workspace.
 */
export function resolveRetrieveScope(opts: {
  userId: string;
  threadProjectId: string | null | undefined;
  requestedProjectId?: string | null;
}): RagScope {
  const threadScope = ragScopeFromThread(opts.userId, opts.threadProjectId);
  if (threadScope.kind === "workspace") return threadScope;
  const requested = opts.requestedProjectId?.trim() || null;
  if (requested) {
    return { kind: "workspace", userId: opts.userId, projectId: requested };
  }
  return threadScope;
}

/** Pure predicate used by tests and the keyword path. */
export function chunkMatchesScope(
  chunk: Pick<RagChunkRow, "userId" | "projectId">,
  scope: RagScope,
): boolean {
  if (chunk.userId !== scope.userId) return false;
  if (scope.kind === "workspace") {
    return chunk.projectId === scope.projectId;
  }
  return true;
}

export function filterChunksByScope<T extends Pick<RagChunkRow, "userId" | "projectId">>(
  chunks: T[],
  scope: RagScope,
): T[] {
  return chunks.filter((c) => chunkMatchesScope(c, scope));
}

export function ragScopeLabel(kind: RagScopeKind): string {
  return kind === "workspace" ? "этот воркспейс" : "вся студия";
}
