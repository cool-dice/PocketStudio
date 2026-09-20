/**
 * Honest library copy. Favorite success toasts only after PATCH.
 */

export const LIBRARY_FAVORITE_ADDED = "Добавлено в избранное";
export const LIBRARY_FAVORITE_REMOVED = "Убрано из избранного";
export const LIBRARY_FAVORITE_FAILED = "Не удалось обновить избранное";

export type LibraryFavoriteToast =
  | { kind: "success"; message: typeof LIBRARY_FAVORITE_ADDED | typeof LIBRARY_FAVORITE_REMOVED }
  | { kind: "error"; message: typeof LIBRARY_FAVORITE_FAILED };

/** Build the toast from the PATCH outcome — never call this before the request returns. */
export function libraryFavoriteToast(
  ok: boolean,
  wasFavorite: boolean,
): LibraryFavoriteToast {
  if (!ok) {
    return { kind: "error", message: LIBRARY_FAVORITE_FAILED };
  }
  return {
    kind: "success",
    message: wasFavorite ? LIBRARY_FAVORITE_REMOVED : LIBRARY_FAVORITE_ADDED,
  };
}
