/**
 * Rank workspaces for «Продолжить работу»: a chat turn updates Thread.updatedAt
 * but not Project.updatedAt, so the workspace list alone can surface the
 * wrong (stale) workspace after a recent thread.
 */

export interface RecencyWorkspace {
  id: string;
  updatedAt: string;
}

export interface RecencyThread {
  projectId: string | null;
  updatedAt: string;
}

export function workspaceRecencyMs(
  workspace: RecencyWorkspace,
  threadRecency: Map<string, number>,
): number {
  const ws = Date.parse(workspace.updatedAt);
  const thread = threadRecency.get(workspace.id) ?? 0;
  const wsMs = Number.isFinite(ws) ? ws : 0;
  return Math.max(wsMs, thread);
}

export function threadRecencyByWorkspace(
  threads: RecencyThread[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of threads) {
    if (!t.projectId) continue;
    const ts = Date.parse(t.updatedAt);
    if (!Number.isFinite(ts)) continue;
    const prev = map.get(t.projectId) ?? 0;
    if (ts > prev) map.set(t.projectId, ts);
  }
  return map;
}

export function rankWorkspacesByRecency<T extends RecencyWorkspace>(
  workspaces: T[],
  threads: RecencyThread[],
): T[] {
  const recency = threadRecencyByWorkspace(threads);
  return [...workspaces].sort(
    (a, b) => workspaceRecencyMs(b, recency) - workspaceRecencyMs(a, recency),
  );
}
