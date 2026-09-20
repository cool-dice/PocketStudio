/**
 * Honest workspace grid / archive. Default list hides archived rows;
 * «Показать архив» loads `?archived=1`. A failed load is not «пока нет
 * воркспейсов»; empty archive is not a load error; starring never drops
 * a row or flips `archived`. Success toasts follow the PATCH outcome.
 */

export const WORKSPACES_EMPTY = "Пока нет ни одного воркспейса";
export const WORKSPACES_EMPTY_HINT =
  "Создайте первый — тип и название, остальное соберёт оркестратор.";
export const WORKSPACES_ARCHIVE_EMPTY = "В архиве пока нет воркспейсов";
export const WORKSPACES_ARCHIVE_EMPTY_HINT =
  "Скрытые воркспейсы появятся здесь.";
export const WORKSPACES_LOAD_ERROR = "Не удалось загрузить воркспейсы";
export const WORKSPACES_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой список.";
export const WORKSPACES_RETRY = "Повторить";
export const WORKSPACES_SHOW_ARCHIVE = "Показать архив";
export const WORKSPACES_HIDE_ARCHIVE = "Скрыть архив";
export const WORKSPACES_ARCHIVE_ACTION = "Архивировать";
export const WORKSPACES_UNARCHIVE_ACTION = "Вернуть из архива";
export const WORKSPACES_ARCHIVED = "Воркспейс в архиве";
export const WORKSPACES_RESTORED = "Воркспейс возвращён";
export const WORKSPACES_ARCHIVE_FAILED = "Не удалось архивировать воркспейс";
export const WORKSPACES_UNARCHIVE_FAILED = "Не удалось вернуть воркспейс";
export const WORKSPACES_FAVORITE_FAILED = "Не удалось обновить избранное";

export type WorkspacesListView = "loading" | "error" | "empty" | "ready";

export function workspacesListView(
  loading: boolean,
  loadError: boolean | string | null,
  count: number,
): WorkspacesListView {
  if (loading) return "loading";
  if (loadError) return "error";
  if (count === 0) return "empty";
  return "ready";
}

/** Empty copy follows the archive toggle; errors never reuse this. */
export function workspacesEmptyCopy(showingArchive: boolean): {
  title: string;
  hint: string;
} {
  return showingArchive
    ? { title: WORKSPACES_ARCHIVE_EMPTY, hint: WORKSPACES_ARCHIVE_EMPTY_HINT }
    : { title: WORKSPACES_EMPTY, hint: WORKSPACES_EMPTY_HINT };
}

/**
 * Grid / home live list never sends `archived=1`. The toggle is the only
 * way to request archived rows — same contract as `api.listWorkspaces`.
 */
export function workspacesListQuery(showingArchive: boolean): {
  archived?: true;
} {
  return showingArchive ? { archived: true } : {};
}

export function workspacesListSearch(showingArchive: boolean): "" | "?archived=1" {
  return showingArchive ? "?archived=1" : "";
}

export type WorkspaceArchiveToast =
  | {
      kind: "success";
      message: typeof WORKSPACES_ARCHIVED | typeof WORKSPACES_RESTORED;
    }
  | {
      kind: "error";
      message: typeof WORKSPACES_ARCHIVE_FAILED | typeof WORKSPACES_UNARCHIVE_FAILED;
    };

/**
 * Toast from the PATCH outcome — never call this before the request returns.
 * `archived` is the intended (and, on success, server) flag.
 */
export function workspaceArchiveToast(
  ok: boolean,
  archived: boolean,
): WorkspaceArchiveToast {
  if (!ok) {
    return {
      kind: "error",
      message: archived ? WORKSPACES_ARCHIVE_FAILED : WORKSPACES_UNARCHIVE_FAILED,
    };
  }
  return {
    kind: "success",
    message: archived ? WORKSPACES_ARCHIVED : WORKSPACES_RESTORED,
  };
}

/**
 * Live grid shows archived=false; «Показать архив» shows archived=true.
 * A failed PATCH keeps every card. After success the card leaves the
 * current view when its new flag no longer matches the toggle.
 */
export function gridWorkspacesAfterArchive<
  T extends { id: string; archived: boolean },
>(
  workspaces: readonly T[],
  id: string,
  nextArchived: boolean,
  showingArchive: boolean,
  ok: boolean,
): T[] {
  if (!ok) return [...workspaces];
  if (showingArchive !== nextArchived) {
    return workspaces.filter((w) => w.id !== id);
  }
  return workspaces.map((w) =>
    w.id === id ? { ...w, archived: nextArchived } : w,
  );
}

/**
 * Starring is independent of the archive toggle: a failed PATCH keeps the
 * previous star, a successful one never drops the card or flips `archived`.
 */
export function gridWorkspacesAfterFavorite<
  T extends { id: string; favorite: boolean; archived: boolean },
>(
  workspaces: readonly T[],
  id: string,
  nextFavorite: boolean,
  ok: boolean,
): T[] {
  if (!ok) return [...workspaces];
  return workspaces.map((w) =>
    w.id === id ? { ...w, favorite: nextFavorite } : w,
  );
}
