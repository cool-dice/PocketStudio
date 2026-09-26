import { describe, expect, test } from "bun:test";

import { resolveWorkspaceTab } from "@/components/workspaces/overview-data";

describe("resolveWorkspaceTab", () => {
  test("book workspace cannot open film-only video tab", () => {
    expect(resolveWorkspaceTab({ type: "book" }, "video")).toBe("chat");
    expect(resolveWorkspaceTab({ type: "book" }, "documents")).toBe("documents");
  });

  test("music workspace keeps documents after notes, not video", () => {
    expect(resolveWorkspaceTab({ type: "music" }, "documents")).toBe("documents");
    expect(resolveWorkspaceTab({ type: "music" }, "video")).toBe("chat");
  });

  test("app workspace keeps code, not video", () => {
    expect(resolveWorkspaceTab({ type: "app" }, "code")).toBe("code");
    expect(resolveWorkspaceTab({ type: "app" }, "video")).toBe("chat");
  });
});
