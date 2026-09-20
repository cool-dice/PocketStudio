import { describe, expect, test } from "bun:test";

import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  test("keeps workspace and area deep links", () => {
    expect(safeNextPath("/w/abc123")).toBe("/w/abc123");
    expect(safeNextPath("/w/abc123?tab=documents&doc=clastworkdoc01")).toBe(
      "/w/abc123?tab=documents&doc=clastworkdoc01",
    );
    expect(safeNextPath("/?area=notebook")).toBe("/?area=notebook");
  });

  test("rejects protocol-relative and external URLs", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/https://evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example/w/x")).toBe("/");
  });

  test("rejects control characters, backslash, and login loops", () => {
    expect(safeNextPath("/w/id\nLocation: https://evil.example")).toBe("/");
    expect(safeNextPath("/w/foo\\bar")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
    expect(safeNextPath("/login?next=/w/x")).toBe("/");
  });

  test("empty or junk falls back to home", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("   ")).toBe("/");
  });
});
