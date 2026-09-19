import { describe, expect, test } from "bun:test";

import {
  emptySearchResults,
  searchExcerpt,
  searchMatches,
  searchTotal,
  SEARCH_MIN_QUERY,
} from "./search";

describe("search matching", () => {
  test("matches ASCII and Cyrillic case-insensitively", () => {
    expect(searchMatches("Хроники Долгой Зимы", "зимы")).toBe(true);
    expect(searchMatches("PocketStudio", "pocket")).toBe(true);
    expect(searchMatches("Маяк", "МАЯК")).toBe(true);
    expect(searchMatches(null, "a")).toBe(false);
    expect(searchMatches("", "ab")).toBe(false);
  });

  test("excerpt windows around the first hit", () => {
    const text = "В начале была мысль, потом маяк за фьордом, потом тишина.";
    const excerpt = searchExcerpt(text, "маяк", 8);
    expect(excerpt).toContain("маяк");
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  test("empty results are zeroed and min query is 2", () => {
    const empty = emptySearchResults();
    expect(searchTotal(empty)).toBe(0);
    expect(empty.threads).toEqual([]);
    expect(empty.notes).toEqual([]);
    expect(empty.projects).toEqual([]);
    expect(SEARCH_MIN_QUERY).toBe(2);
  });
});
