/**
 * Honest chat-thread list / delete / rename / archive. A failed load is not
 * «пока нет диалогов»; the sidebar drops a row only after DELETE/PATCH
 * succeeds; success toasts are built from the API outcome, never before.
 */

export const THREADS_EMPTY = "Пока нет диалогов";
export const THREADS_EMPTY_HINT =
  "Начните новый — и он появится здесь.";
export const THREADS_ARCHIVE_EMPTY = "В архиве пока нет диалогов";
export const THREADS_ARCHIVE_EMPTY_HINT =
  "Скрытые диалоги появятся здесь.";
export const THREADS_LOAD_ERROR = "Не удалось загрузить список диалогов";
export const THREADS_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой список.";
export const THREADS_RETRY = "Повторить";
export const THREADS_DELETE_FAILED = "Не удалось удалить диалог";
export const THREADS_RENAME_FAILED = "Не удалось переименовать диалог";
export const THREADS_SHOW_ARCHIVE = "Показать архив";
export const THREADS_HIDE_ARCHIVE = "Скрыть архив";
export const THREADS_ARCHIVE_ACTION = "Архивировать";
export const THREADS_UNARCHIVE_ACTION = "Вернуть из архива";
export const THREADS_ARCHIVED = "Диалог в архиве";
export const THREADS_RESTORED = "Диалог возвращён";
export const THREADS_ARCHIVE_FAILED = "Не удалось архивировать диалог";
export const THREADS_UNARCHIVE_FAILED = "Не удалось вернуть диалог";

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

/** Empty copy follows the archive toggle; errors never reuse this. */
export function threadsEmptyCopy(showingArchive: boolean): {
  title: string;
  hint: string;
} {
  return showingArchive
    ? { title: THREADS_ARCHIVE_EMPTY, hint: THREADS_ARCHIVE_EMPTY_HINT }
    : { title: THREADS_EMPTY, hint: THREADS_EMPTY_HINT };
}

export type ThreadArchiveToast =
  | { kind: "success"; message: typeof THREADS_ARCHIVED | typeof THREADS_RESTORED }
  | {
      kind: "error";
      message: typeof THREADS_ARCHIVE_FAILED | typeof THREADS_UNARCHIVE_FAILED;
    };

/**
 * Toast from the PATCH outcome — never call this before the request returns.
 * `archived` is the intended (and, on success, server) flag.
 */
export function threadArchiveToast(
  ok: boolean,
  archived: boolean,
): ThreadArchiveToast {
  if (!ok) {
    return {
      kind: "error",
      message: archived ? THREADS_ARCHIVE_FAILED : THREADS_UNARCHIVE_FAILED,
    };
  }
  return {
    kind: "success",
    message: archived ? THREADS_ARCHIVED : THREADS_RESTORED,
  };
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

/**
 * Live list shows archived=false; «Показать архив» shows archived=true.
 * A failed PATCH keeps every row. After success the row leaves the current
 * view when its new flag no longer matches the toggle.
 */
export function sidebarThreadsAfterArchive<T extends { id: string; archived: boolean }>(
  threads: readonly T[],
  id: string,
  nextArchived: boolean,
  showingArchive: boolean,
  ok: boolean,
): T[] {
  if (!ok) return [...threads];
  if (showingArchive !== nextArchived) {
    return threads.filter((t) => t.id !== id);
  }
  return threads.map((t) => (t.id === id ? { ...t, archived: nextArchived } : t));
}

/** Composer leaves the row only when archive PATCH hid it from this list. */
export function composerTargetAfterArchive(
  activeId: string | null,
  archivedId: string,
  remainingIds: readonly string[],
  droppedFromList: boolean,
): string | null {
  if (!droppedFromList) return activeId;
  return composerTargetAfterDelete(activeId, archivedId, remainingIds);
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
