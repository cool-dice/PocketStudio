import { describe, expect, test } from "bun:test";

import { isStaleSectionSave, nextSaveSeq } from "./section-save-race";

describe("section autosave race", () => {
  test("a slower older save is stale once a newer one started", () => {
    const map = new Map<string, number>();
    const first = nextSaveSeq(map, "sec-1");
    const second = nextSaveSeq(map, "sec-1");
    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(isStaleSectionSave(map, "sec-1", first)).toBe(true);
    expect(isStaleSectionSave(map, "sec-1", second)).toBe(false);
  });

  test("saves of different sections do not cancel each other", () => {
    const map = new Map<string, number>();
    const a = nextSaveSeq(map, "a");
    const b = nextSaveSeq(map, "b");
    expect(isStaleSectionSave(map, "a", a)).toBe(false);
    expect(isStaleSectionSave(map, "b", b)).toBe(false);
  });
});
