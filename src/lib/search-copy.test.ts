import { describe, expect, test } from "bun:test";

import {
  SEARCH_ERROR,
  SEARCH_ERROR_HINT,
  SEARCH_HINT_WORKSPACE,
  SEARCH_MIN_HINT,
  searchEmptyMessage,
} from "./search-copy";

describe("search empty vs error copy", () => {
  test("empty is about no hits, error is not empty", () => {
    const empty = searchEmptyMessage("маяк");
    expect(empty).toMatch(/[А-Яа-яЁё]/);
    expect(empty).toContain("маяк");
    expect(empty).toMatch(/ничего не нашлось/i);
    expect(SEARCH_ERROR).toMatch(/[А-Яа-яЁё]/);
    expect(SEARCH_ERROR).not.toBe(empty);
    expect(SEARCH_ERROR).not.toMatch(/ничего не нашлось/i);
    expect(SEARCH_ERROR_HINT).toMatch(/не пустой результат/i);
  });

  test("workspace hint is distinct from the two-character prompt", () => {
    expect(SEARCH_HINT_WORKSPACE).toMatch(/воркспейс/i);
    expect(SEARCH_MIN_HINT).toMatch(/2 символ/i);
    expect(SEARCH_HINT_WORKSPACE).not.toBe(SEARCH_MIN_HINT);
  });
});
