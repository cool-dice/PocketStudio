import { describe, expect, test } from "bun:test";

import { isDeletableRelPath } from "./rel-path";

describe("isDeletableRelPath", () => {
  test("rejects the project root aliases", () => {
    expect(isDeletableRelPath("")).toBe(false);
    expect(isDeletableRelPath(".")).toBe(false);
    expect(isDeletableRelPath("./")).toBe(false);
    expect(isDeletableRelPath("/")).toBe(false);
    expect(isDeletableRelPath("  ")).toBe(false);
  });

  test("allows real files and folders", () => {
    expect(isDeletableRelPath("README.md")).toBe(true);
    expect(isDeletableRelPath("src/app.ts")).toBe(true);
    expect(isDeletableRelPath("src")).toBe(true);
  });
});
