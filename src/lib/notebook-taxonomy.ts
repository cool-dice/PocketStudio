/**
 * Honest notebook categories and tags. Create/rename/delete only after
 * the API; a failed load is not «пока нет»; empty is not an error.
 * Success toasts are built from the outcome, never before the request.
 */

export const CATEGORY_NAME_MIN = 1;
export const CATEGORY_NAME_MAX = 40;
export const TAG_NAME_MIN = 1;
export const TAG_NAME_MAX = 32;

export const CATEGORY_NAME_EMPTY = "Название категории не может быть пустым";
export const CATEGORY_NAME_TOO_LONG =
  "Название категории не может превышать 40 символов";
export const CATEGORY_NAME_TAKEN = "Категория с таким названием уже существует";
export const CATEGORY_NOT_FOUND = "Категория не найдена";
export const CATEGORY_COLOR_INVALID = "Недопустимый цвет";
export const CATEGORY_ICON_INVALID = "Недопустимая иконка";

export const TAG_NAME_EMPTY = "Название тега не может быть пустым";
export const TAG_NAME_TOO_LONG =
  "Название тега не может превышать 32 символов";
export const TAG_NAME_TAKEN = "Тег с таким названием уже существует";
export const TAG_NOT_FOUND = "Тег не найден";

export const CATEGORIES_EMPTY = "Пока нет категорий";
export const CATEGORIES_EMPTY_HINT =
  "Создайте первую — фильтр и чипы появятся в блокноте.";
export const CATEGORIES_LOAD_ERROR = "Не удалось загрузить категории";
export const CATEGORIES_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой список.";

export const TAGS_EMPTY = "Пока нет тегов";
export const TAGS_EMPTY_HINT =
  "Создайте тег или добавьте его на заметке — список появится здесь.";
export const TAGS_LOAD_ERROR = "Не удалось загрузить теги";
export const TAGS_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой список.";

export const TAXONOMY_RETRY = "Повторить";
export const TAXONOMY_DIALOG_TITLE = "Категории и теги";
export const TAXONOMY_DIALOG_HINT =
  "Только ваши. Удаление категории снимает её с ваших заметок, чужие не трогает.";
export const TAXONOMY_OPEN = "Категории и теги";
export const TAXONOMY_CREATE = "Создать";
export const TAXONOMY_RENAME = "Переименовать";
export const TAXONOMY_DELETE = "Удалить";
export const TAXONOMY_CANCEL = "Отмена";

export const CATEGORY_CREATED = "Категория создана";
export const CATEGORY_RENAMED = "Категория переименована";
export const CATEGORY_DELETED = "Категория удалена";
export const CATEGORY_CREATE_FAILED = "Не удалось создать категорию";
export const CATEGORY_RENAME_FAILED = "Не удалось переименовать категорию";
export const CATEGORY_DELETE_FAILED = "Не удалось удалить категорию";
export const CATEGORY_DELETE_CONFIRM = "Удалить категорию?";
export const CATEGORY_DELETE_CONFIRM_HINT =
  "С ваших заметок категория снимется. Чужие заметки не затронем.";

export const TAG_CREATED = "Тег создан";
export const TAG_RENAMED = "Тег переименован";
export const TAG_DELETED = "Тег удалён";
export const TAG_CREATE_FAILED = "Не удалось создать тег";
export const TAG_RENAME_FAILED = "Не удалось переименовать тег";
export const TAG_DELETE_FAILED = "Не удалось удалить тег";
export const TAG_DELETE_CONFIRM = "Удалить тег?";
export const TAG_DELETE_CONFIRM_HINT =
  "Связь с вашими заметками пропадёт, текст заметок останется.";

export type TaxonomyKind = "category" | "tag";
export type TaxonomyOp = "create" | "rename" | "delete";
export type TaxonomyListView = "loading" | "error" | "empty" | "ready";

export type NameParse =
  | { ok: true; name: string }
  | { ok: false; error: string };

function trimName(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** Empty is a field error, not a success and not a load failure. */
export function validateCategoryName(raw: unknown): NameParse {
  const name = trimName(raw);
  if (!name) return { ok: false, error: CATEGORY_NAME_EMPTY };
  if (name.length > CATEGORY_NAME_MAX) {
    return { ok: false, error: CATEGORY_NAME_TOO_LONG };
  }
  return { ok: true, name };
}

/** Leading `#` is stripped the same way note PATCH tags are. */
export function validateTagName(raw: unknown): NameParse {
  const name = trimName(raw).replace(/^#+/, "");
  if (!name) return { ok: false, error: TAG_NAME_EMPTY };
  if (name.length > TAG_NAME_MAX) {
    return { ok: false, error: TAG_NAME_TOO_LONG };
  }
  return { ok: true, name };
}

export function taxonomyListView(
  loading: boolean,
  loadError: string | null,
  count: number,
): TaxonomyListView {
  if (loading) return "loading";
  if (loadError) return "error";
  if (count === 0) return "empty";
  return "ready";
}

export function taxonomyEmptyCopy(kind: TaxonomyKind): {
  title: string;
  hint: string;
} {
  return kind === "category"
    ? { title: CATEGORIES_EMPTY, hint: CATEGORIES_EMPTY_HINT }
    : { title: TAGS_EMPTY, hint: TAGS_EMPTY_HINT };
}

export function taxonomyLoadErrorCopy(kind: TaxonomyKind): {
  title: string;
  hint: string;
} {
  return kind === "category"
    ? { title: CATEGORIES_LOAD_ERROR, hint: CATEGORIES_LOAD_ERROR_HINT }
    : { title: TAGS_LOAD_ERROR, hint: TAGS_LOAD_ERROR_HINT };
}

const SUCCESS: Record<TaxonomyKind, Record<TaxonomyOp, string>> = {
  category: {
    create: CATEGORY_CREATED,
    rename: CATEGORY_RENAMED,
    delete: CATEGORY_DELETED,
  },
  tag: {
    create: TAG_CREATED,
    rename: TAG_RENAMED,
    delete: TAG_DELETED,
  },
};

const FAILED: Record<TaxonomyKind, Record<TaxonomyOp, string>> = {
  category: {
    create: CATEGORY_CREATE_FAILED,
    rename: CATEGORY_RENAME_FAILED,
    delete: CATEGORY_DELETE_FAILED,
  },
  tag: {
    create: TAG_CREATE_FAILED,
    rename: TAG_RENAME_FAILED,
    delete: TAG_DELETE_FAILED,
  },
};

export type TaxonomyToast =
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

/**
 * Toast from the API outcome — never call this before the request returns.
 */
export function taxonomyToast(
  ok: boolean,
  kind: TaxonomyKind,
  op: TaxonomyOp,
): TaxonomyToast {
  if (!ok) return { kind: "error", message: FAILED[kind][op] };
  return { kind: "success", message: SUCCESS[kind][op] };
}

/** List drops the row only when DELETE returned ok. */
export function taxonomyAfterDelete<T extends { id: string }>(
  rows: readonly T[],
  deletedId: string,
  ok: boolean,
): T[] {
  if (!ok) return [...rows];
  return rows.filter((row) => row.id !== deletedId);
}

/** Label follows the PATCH body, never an optimistic guess. */
export function taxonomyRenamed(
  ok: boolean,
  previous: string,
  serverName: string,
): string {
  return ok ? serverName : previous;
}

/** After a successful create, append the server row — never a client fake. */
export function taxonomyAfterCreate<T>(
  rows: readonly T[],
  created: T | null,
  ok: boolean,
): T[] {
  if (!ok || !created) return [...rows];
  return [...rows, created];
}
