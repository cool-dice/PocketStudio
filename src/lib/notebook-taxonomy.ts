/**
 * Honest notebook categories and tags. Create/rename/delete only after
 * the API; a failed load is not «пока нет»; empty is not an error.
 * Success toasts are built from the outcome, never before the request.
 * Category color/icon and tag color follow the same allowlists as POST/PATCH.
 * Tags have no icon field in the API — color only.
 */

import {
  COLORS,
  ICONS,
  isCategoryColor,
  isCategoryIcon,
  type CategoryColor,
  type CategoryIcon,
} from "@/lib/note-utils";

export const CATEGORY_NAME_MIN = 1;
export const CATEGORY_NAME_MAX = 40;
export const TAG_NAME_MIN = 1;
export const TAG_NAME_MAX = 32;

/** Same defaults as POST /api/categories when color/icon are omitted. */
export const CATEGORY_DEFAULT_COLOR: CategoryColor = "stone";
export const CATEGORY_DEFAULT_ICON: CategoryIcon = "lightbulb";
/** Same default as POST /api/tags when color is omitted. */
export const TAG_DEFAULT_COLOR: CategoryColor = CATEGORY_DEFAULT_COLOR;

export const CATEGORY_NAME_EMPTY = "Название категории не может быть пустым";
export const CATEGORY_NAME_TOO_LONG =
  "Название категории не может превышать 40 символов";
export const CATEGORY_NAME_TAKEN = "Категория с таким названием уже существует";
export const CATEGORY_NOT_FOUND = "Категория не найдена";
export const CATEGORY_COLOR_INVALID = "Недопустимый цвет";
export const CATEGORY_ICON_INVALID = "Недопустимая иконка";
export const TAG_COLOR_INVALID = CATEGORY_COLOR_INVALID;

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
export const TAXONOMY_SAVE = "Сохранить";
export const TAXONOMY_DELETE = "Удалить";
export const TAXONOMY_CANCEL = "Отмена";
export const TAXONOMY_COLOR = "Цвет";
export const TAXONOMY_ICON = "Иконка";

export const CATEGORY_CREATED = "Категория создана";
export const CATEGORY_RENAMED = "Категория переименована";
export const CATEGORY_UPDATED = "Категория обновлена";
export const CATEGORY_DELETED = "Категория удалена";
export const CATEGORY_CREATE_FAILED = "Не удалось создать категорию";
export const CATEGORY_RENAME_FAILED = "Не удалось переименовать категорию";
export const CATEGORY_UPDATE_FAILED = "Не удалось обновить категорию";
export const CATEGORY_DELETE_FAILED = "Не удалось удалить категорию";
export const CATEGORY_DELETE_CONFIRM = "Удалить категорию?";
export const CATEGORY_DELETE_CONFIRM_HINT =
  "С ваших заметок категория снимется. Чужие заметки не затронем.";

export const TAG_CREATED = "Тег создан";
export const TAG_RENAMED = "Тег переименован";
export const TAG_UPDATED = "Тег обновлён";
export const TAG_DELETED = "Тег удалён";
export const TAG_CREATE_FAILED = "Не удалось создать тег";
export const TAG_RENAME_FAILED = "Не удалось переименовать тег";
export const TAG_UPDATE_FAILED = "Не удалось обновить тег";
export const TAG_DELETE_FAILED = "Не удалось удалить тег";
export const TAG_DELETE_CONFIRM = "Удалить тег?";
export const TAG_DELETE_CONFIRM_HINT =
  "Связь с вашими заметками пропадёт, текст заметок останется.";

export type TaxonomyKind = "category" | "tag";
export type TaxonomyOp = "create" | "rename" | "update" | "delete";
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

/** Junk or missing → API default, never an unlisted key in POST/PATCH. */
export function parseCategoryColor(raw: unknown): CategoryColor {
  return typeof raw === "string" && isCategoryColor(raw)
    ? raw
    : CATEGORY_DEFAULT_COLOR;
}

/** Same allowlist as categories — junk or missing → POST default. */
export function parseTagColor(raw: unknown): CategoryColor {
  return typeof raw === "string" && isCategoryColor(raw)
    ? raw
    : TAG_DEFAULT_COLOR;
}

/** Junk or missing → API default, never an unlisted key in POST/PATCH. */
export function parseCategoryIcon(raw: unknown): CategoryIcon {
  return typeof raw === "string" && isCategoryIcon(raw)
    ? raw
    : CATEGORY_DEFAULT_ICON;
}

/** Body fragment for category POST/PATCH — only allowlisted keys. */
export function categoryStylePayload(
  color: unknown,
  icon: unknown,
): { color: CategoryColor; icon: CategoryIcon } {
  return {
    color: parseCategoryColor(color),
    icon: parseCategoryIcon(icon),
  };
}

/** Body fragment for tag POST/PATCH — color only, same allowlist. */
export function tagColorPayload(color: unknown): { color: CategoryColor } {
  return { color: parseTagColor(color) };
}

export const CATEGORY_COLOR_KEYS: readonly CategoryColor[] = COLORS;
export const TAG_COLOR_KEYS: readonly CategoryColor[] = COLORS;
export const CATEGORY_ICON_KEYS: readonly CategoryIcon[] = ICONS;

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
    update: CATEGORY_UPDATED,
    delete: CATEGORY_DELETED,
  },
  tag: {
    create: TAG_CREATED,
    rename: TAG_RENAMED,
    update: TAG_UPDATED,
    delete: TAG_DELETED,
  },
};

const FAILED: Record<TaxonomyKind, Record<TaxonomyOp, string>> = {
  category: {
    create: CATEGORY_CREATE_FAILED,
    rename: CATEGORY_RENAME_FAILED,
    update: CATEGORY_UPDATE_FAILED,
    delete: CATEGORY_DELETE_FAILED,
  },
  tag: {
    create: TAG_CREATE_FAILED,
    rename: TAG_RENAME_FAILED,
    update: TAG_UPDATE_FAILED,
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

/**
 * Name/color/icon follow the PATCH body, never an optimistic guess.
 * Call only after the API returns.
 */
export function taxonomyCategoryPatched<
  T extends { name: string; color: string; icon: string },
>(
  ok: boolean,
  previous: T,
  server: { name: string; color: string; icon: string },
): T {
  if (!ok) return previous;
  return {
    ...previous,
    name: server.name,
    color: server.color,
    icon: server.icon,
  };
}

/**
 * Name/color follow the PATCH body, never an optimistic guess.
 * Tags have no icon. Call only after the API returns.
 */
export function taxonomyTagPatched<T extends { name: string; color: string }>(
  ok: boolean,
  previous: T,
  server: { name: string; color: string },
): T {
  if (!ok) return previous;
  return {
    ...previous,
    name: server.name,
    color: server.color,
  };
}
