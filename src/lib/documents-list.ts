/**
 * Manuscript list: a failed fetch is not «документов пока нет»;
 * creating a doc must land in the local list, not only in a toast.
 */

export const DOCUMENTS_LOAD_ERROR = "Не удалось загрузить документы";
export const DOCUMENTS_LOAD_ERROR_HINT =
  "Это не пустая библиотека — проверьте соединение и обновите.";
export const DOCUMENTS_RETRY = "Повторить";

export type DocumentsListView = "loading" | "error" | "empty" | "ready";

export function documentsListView(
  loading: boolean,
  loadError: boolean,
  count: number,
): DocumentsListView {
  if (loading) return "loading";
  if (loadError) return "error";
  if (count === 0) return "empty";
  return "ready";
}

/** New manuscript goes first; a duplicate id is replaced, not dropped. */
export function documentsAfterCreate<T extends { id: string }>(
  list: readonly T[],
  created: T,
): T[] {
  return [created, ...list.filter((doc) => doc.id !== created.id)];
}
