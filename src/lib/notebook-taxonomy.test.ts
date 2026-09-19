import { describe, expect, test } from "bun:test";

import {
  CATEGORIES_EMPTY,
  CATEGORIES_EMPTY_HINT,
  CATEGORIES_LOAD_ERROR,
  CATEGORIES_LOAD_ERROR_HINT,
  CATEGORY_CREATED,
  CATEGORY_CREATE_FAILED,
  CATEGORY_DELETED,
  CATEGORY_DELETE_FAILED,
  CATEGORY_NAME_EMPTY,
  CATEGORY_NAME_MAX,
  CATEGORY_NAME_TOO_LONG,
  CATEGORY_RENAMED,
  CATEGORY_RENAME_FAILED,
  TAGS_EMPTY,
  TAGS_LOAD_ERROR,
  TAGS_LOAD_ERROR_HINT,
  TAG_CREATED,
  TAG_CREATE_FAILED,
  TAG_DELETED,
  TAG_DELETE_FAILED,
  TAG_NAME_EMPTY,
  TAG_NAME_MAX,
  TAG_NAME_TOO_LONG,
  TAG_RENAMED,
  TAG_RENAME_FAILED,
  TAXONOMY_RETRY,
  taxonomyAfterCreate,
  taxonomyAfterDelete,
  taxonomyEmptyCopy,
  taxonomyListView,
  taxonomyLoadErrorCopy,
  taxonomyRenamed,
  taxonomyToast,
  validateCategoryName,
  validateTagName,
} from "./notebook-taxonomy";

describe("category/tag name empty vs error", () => {
  test("empty and whitespace are field errors, not success", () => {
    expect(validateCategoryName("")).toEqual({
      ok: false,
      error: CATEGORY_NAME_EMPTY,
    });
    expect(validateCategoryName("   ")).toEqual({
      ok: false,
      error: CATEGORY_NAME_EMPTY,
    });
    expect(validateTagName("")).toEqual({ ok: false, error: TAG_NAME_EMPTY });
    expect(validateTagName("   ")).toEqual({ ok: false, error: TAG_NAME_EMPTY });
    expect(validateTagName("#")).toEqual({ ok: false, error: TAG_NAME_EMPTY });
    expect(CATEGORY_NAME_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(TAG_NAME_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(CATEGORY_NAME_EMPTY).not.toMatch(/не удалось/i);
    expect(CATEGORY_CREATE_FAILED).not.toBe(CATEGORY_NAME_EMPTY);
  });

  test("too long is distinct from empty; names trim", () => {
    expect(validateCategoryName("x".repeat(CATEGORY_NAME_MAX + 1))).toEqual({
      ok: false,
      error: CATEGORY_NAME_TOO_LONG,
    });
    expect(validateTagName("x".repeat(TAG_NAME_MAX + 1))).toEqual({
      ok: false,
      error: TAG_NAME_TOO_LONG,
    });
    expect(validateCategoryName("  Идеи  ")).toEqual({
      ok: true,
      name: "Идеи",
    });
    expect(validateTagName("  #канон  ")).toEqual({ ok: true, name: "канон" });
    expect(CATEGORY_NAME_TOO_LONG).not.toBe(CATEGORY_NAME_EMPTY);
    expect(TAG_NAME_TOO_LONG).not.toBe(TAG_CREATE_FAILED);
  });
});

describe("taxonomy list empty vs error copy", () => {
  test("load error is not the empty-list message", () => {
    expect(CATEGORIES_LOAD_ERROR).not.toBe(CATEGORIES_EMPTY);
    expect(CATEGORIES_LOAD_ERROR).not.toMatch(/пока нет/i);
    expect(CATEGORIES_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(TAGS_LOAD_ERROR).not.toBe(TAGS_EMPTY);
    expect(TAGS_LOAD_ERROR).not.toMatch(/пока нет/i);
    expect(TAGS_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(CATEGORIES_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(TAXONOMY_RETRY).toMatch(/повторить/i);
    const catEmpty = taxonomyEmptyCopy("category");
    const tagEmpty = taxonomyEmptyCopy("tag");
    expect(catEmpty.title).toBe(CATEGORIES_EMPTY);
    expect(tagEmpty.title).toBe(TAGS_EMPTY);
    expect(catEmpty.hint).toBe(CATEGORIES_EMPTY_HINT);
    expect(taxonomyLoadErrorCopy("category").title).toBe(CATEGORIES_LOAD_ERROR);
    expect(taxonomyLoadErrorCopy("tag").title).toBe(TAGS_LOAD_ERROR);
  });

  test("failed load is error, not empty; successful [] is empty", () => {
    expect(taxonomyListView(false, CATEGORIES_LOAD_ERROR, 0)).toBe("error");
    expect(taxonomyListView(false, CATEGORIES_LOAD_ERROR, 3)).toBe("error");
    expect(taxonomyListView(true, null, 0)).toBe("loading");
    expect(taxonomyListView(true, CATEGORIES_LOAD_ERROR, 0)).toBe("loading");
    expect(taxonomyListView(false, null, 0)).toBe("empty");
    expect(taxonomyListView(false, null, 2)).toBe("ready");
  });
});

describe("taxonomy toast after API, list follows outcome", () => {
  test("success toast only when ok — never before the API", () => {
    expect(taxonomyToast(false, "category", "create")).toEqual({
      kind: "error",
      message: CATEGORY_CREATE_FAILED,
    });
    expect(taxonomyToast(true, "category", "create")).toEqual({
      kind: "success",
      message: CATEGORY_CREATED,
    });
    expect(taxonomyToast(false, "category", "rename")).toEqual({
      kind: "error",
      message: CATEGORY_RENAME_FAILED,
    });
    expect(taxonomyToast(true, "category", "rename")).toEqual({
      kind: "success",
      message: CATEGORY_RENAMED,
    });
    expect(taxonomyToast(false, "category", "delete")).toEqual({
      kind: "error",
      message: CATEGORY_DELETE_FAILED,
    });
    expect(taxonomyToast(true, "category", "delete")).toEqual({
      kind: "success",
      message: CATEGORY_DELETED,
    });
    expect(taxonomyToast(false, "tag", "create").message).toBe(TAG_CREATE_FAILED);
    expect(taxonomyToast(true, "tag", "create").message).toBe(TAG_CREATED);
    expect(taxonomyToast(false, "tag", "rename").message).toBe(TAG_RENAME_FAILED);
    expect(taxonomyToast(true, "tag", "rename").message).toBe(TAG_RENAMED);
    expect(taxonomyToast(false, "tag", "delete").message).toBe(TAG_DELETE_FAILED);
    expect(taxonomyToast(true, "tag", "delete").message).toBe(TAG_DELETED);
    expect(CATEGORY_CREATE_FAILED).toMatch(/не удалось/i);
    expect(CATEGORY_CREATED).not.toMatch(/не удалось/i);
    expect(taxonomyToast(false, "category", "delete").kind).not.toBe("success");
  });

  test("failed DELETE keeps every row; success drops only that id", () => {
    const rows = [
      { id: "a", name: "Идеи" },
      { id: "b", name: "Быт" },
    ];
    expect(taxonomyAfterDelete(rows, "a", false)).toEqual(rows);
    expect(taxonomyAfterDelete(rows, "a", true).map((r) => r.id)).toEqual(["b"]);
  });

  test("rename label follows the server, never an optimistic guess", () => {
    expect(taxonomyRenamed(false, "Идеи", "Новое")).toBe("Идеи");
    expect(taxonomyRenamed(true, "Идеи", "Новое")).toBe("Новое");
  });

  test("create appends only the server row after ok", () => {
    const rows = [{ id: "a", name: "Идеи" }];
    const created = { id: "b", name: "Быт" };
    expect(taxonomyAfterCreate(rows, created, false)).toEqual(rows);
    expect(taxonomyAfterCreate(rows, null, true)).toEqual(rows);
    expect(taxonomyAfterCreate(rows, created, true)).toEqual([...rows, created]);
  });
});
