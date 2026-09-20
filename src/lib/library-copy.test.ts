import { describe, expect, test } from "bun:test";

import {
  LIBRARY_FAVORITE_ADDED,
  LIBRARY_FAVORITE_FAILED,
  LIBRARY_FAVORITE_REMOVED,
  libraryFavoriteToast,
} from "./library-copy";

describe("library favorite copy", () => {
  test("failure is Russian and is not a success toast", () => {
    const failed = libraryFavoriteToast(false, false);
    expect(failed).toEqual({ kind: "error", message: LIBRARY_FAVORITE_FAILED });
    expect(LIBRARY_FAVORITE_FAILED).toMatch(/[А-Яа-яЁё]/);
    expect(LIBRARY_FAVORITE_FAILED).not.toBe(LIBRARY_FAVORITE_ADDED);
    expect(LIBRARY_FAVORITE_FAILED).not.toBe(LIBRARY_FAVORITE_REMOVED);
    expect(LIBRARY_FAVORITE_FAILED).toMatch(/не удалось/i);
  });

  test("success copy depends on prior star and only after ok", () => {
    expect(libraryFavoriteToast(true, false)).toEqual({
      kind: "success",
      message: LIBRARY_FAVORITE_ADDED,
    });
    expect(libraryFavoriteToast(true, true)).toEqual({
      kind: "success",
      message: LIBRARY_FAVORITE_REMOVED,
    });
    expect(LIBRARY_FAVORITE_ADDED).toMatch(/добавлено/i);
    expect(LIBRARY_FAVORITE_REMOVED).toMatch(/убрано/i);
    expect(libraryFavoriteToast(false, true).kind).toBe("error");
  });
});
