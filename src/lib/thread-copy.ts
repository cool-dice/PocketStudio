/**
 * Honest chat-thread list / delete / rename. A failed load is not «пока нет
 * диалогов»; the sidebar drops a row only after DELETE succeeds; the composer
 * never keeps sending to a deleted thread id.
 */

export const THREADS_EMPTY = "Пока нет диалогов";
export const THREADS_EMPTY_HINT =
  "Начните новый — и он появится здесь.";
export const THREADS_LOAD_ERROR = "Не удалось загрузить список диалогов";
export const THREADS_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой список.";
export const THREADS_RETRY = "Повторить";
export const THREADS_DELETE_FAILED = "Не удалось удалить диалог";
export const THREADS_RENAME_FAILED = "Не удалось переименовать диалог";

export type ThreadsListView = "loading" | "error" | "empty" | "ready";

export function threadsListView(
  loading: boolean,
  loadError: string | null,
  count: number,
): ThreadsListView {
  if (loading) return "loading";
  if (loadError) return "error";
  if (count === 0) return "empty";
  return "ready";
}

/** Next thread the composer should bind after a successful delete. */
export function nextThreadIdAfterDelete(
  ids: readonly string[],
  deletedId: string,
): string | null {
  return ids.find((id) => id !== deletedId) ?? null;
}

/**
 * If the deleted row was active, leave it immediately — otherwise keep the
 * current composer target. `remainingIds` is the list before the row is
 * dropped (deletedId may still be present).
 */
export function composerTargetAfterDelete(
  activeId: string | null,
  deletedId: string,
  remainingIds: readonly string[],
): string | null {
  if (activeId !== deletedId) return activeId;
  return nextThreadIdAfterDelete(remainingIds, deletedId);
}

/** Sidebar drops the row only when DELETE returned ok. */
export function sidebarThreadsAfterDelete<T extends { id: string }>(
  threads: readonly T[],
  deletedId: string,
  ok: boolean,
): T[] {
  if (!ok) return [...threads];
  return threads.filter((t) => t.id !== deletedId);
}

/** Title in the list follows the PATCH body, never an optimistic guess. */
export function renamedTitle(
  ok: boolean,
  previous: string,
  serverTitle: string,
): string {
  return ok ? serverTitle : previous;
}

/**
 * Null means «create a new thread» (fresh account / last one deleted).
 * A deleted or unknown id must not be reused for `message:send`.
 */
export function resolveSendThreadId(
  activeId: string | null,
  knownIds: readonly string[],
  deletedIds: ReadonlySet<string> | Iterable<string>,
): string | null {
  if (!activeId) return null;
  const deleted =
    deletedIds instanceof Set ? deletedIds : new Set(deletedIds);
  if (deleted.has(activeId)) return null;
  if (!knownIds.includes(activeId)) return null;
  return activeId;
}
