import { describe, expect, test } from "bun:test";

import { applyPatchArgs, applyUnifiedDiff, PatchError } from "./apply-patch";

describe("applyExactReplace", () => {
  test("replaces first occurrence", () => {
    const { next, replacements } = applyPatchArgs({
      content: "aaa bbb aaa",
      oldText: "aaa",
      newText: "ccc",
    });
    expect(next).toBe("ccc bbb aaa");
    expect(replacements).toBe(1);
  });

  test("replaceAll", () => {
    const { next, replacements } = applyPatchArgs({
      content: "aaa bbb aaa",
      oldText: "aaa",
      newText: "ccc",
      replaceAll: true,
    });
    expect(next).toBe("ccc bbb ccc");
    expect(replacements).toBe(2);
  });

  test("throws when fragment missing", () => {
    expect(() =>
      applyPatchArgs({ content: "hello", oldText: "zzz", newText: "y" }),
    ).toThrow(PatchError);
  });
});

describe("applyUnifiedDiff", () => {
  test("applies a context hunk", () => {
    const file = ["line1", "old", "line3"].join("\n");
    const patch = [
      "--- a/app/page.tsx",
      "+++ b/app/page.tsx",
      "@@ -1,3 +1,3 @@",
      " line1",
      "-old",
      "+new",
      " line3",
    ].join("\n");
    expect(applyUnifiedDiff(file, patch)).toBe(["line1", "new", "line3"].join("\n"));
  });

  test("rejects a hunk that does not match", () => {
    expect(() =>
      applyUnifiedDiff("only", "@@\n-missing\n+here\n"),
    ).toThrow(PatchError);
  });
});

describe("workspace path stay inside the project", () => {
  test("safeJoin rejects parent traversal", async () => {
    const { safeJoin, WorkspaceError, projectRoot } = await import("./workspace");
    const root = projectRoot("proj_ok");
    expect(() => safeJoin(root, "../secret")).toThrow(WorkspaceError);
    expect(() => safeJoin(root, "foo/../../etc/passwd")).toThrow(WorkspaceError);
    expect(() => safeJoin(root, "/etc/passwd")).not.toThrow();
    const inside = safeJoin(root, "/etc/passwd");
    expect(inside.startsWith(root)).toBe(true);
    expect(inside.includes("..")).toBe(false);
  });
});
