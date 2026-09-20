import { describe, expect, test } from "bun:test";

import { resolveWorkspaceTab } from "@/components/workspaces/overview-data";

describe("resolveWorkspaceTab", () => {
  test("book workspace cannot open film-only video tab", () => {
    expect(resolveWorkspaceTab({ type: "book" }, "video")).toBe("chat");
    expect(resolveWorkspaceTab({ type: "book" }, "documents")).toBe("documents");
  });

  test("app workspace keeps code, not video", () => {
    expect(resolveWorkspaceTab({ type: "app" }, "code")).toBe("code");
    expect(resolveWorkspaceTab({ type: "app" }, "video")).toBe("chat");
  });
});
