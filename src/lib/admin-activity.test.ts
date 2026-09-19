import { describe, expect, test } from "bun:test";

import { lastActivityOf } from "./admin-activity";

describe("lastActivityOf", () => {
  test("returns null when the user has no content timestamps", () => {
    expect(lastActivityOf([null, undefined])).toBeNull();
    expect(lastActivityOf([])).toBeNull();
  });

  test("picks the latest content timestamp and ignores account clocks", () => {
    const notes = new Date("2026-01-02T00:00:00.000Z");
    const threads = new Date("2026-03-01T00:00:00.000Z");
    const latest = lastActivityOf([notes, threads, null]);
    expect(latest?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });
});
