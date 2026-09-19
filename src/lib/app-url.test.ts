import { describe, expect, test } from "bun:test";

import { parseAppLocation, pathFor } from "./app-url";

describe("parseAppLocation", () => {
  test("workspace path with tab", () => {
    expect(parseAppLocation("/w/ws1", new URLSearchParams("tab=documents"))).toEqual({
      mainArea: "workspace",
      workspaceId: "ws1",
      workspaceTab: "documents",
    });
  });

  test("unknown tab falls back to chat", () => {
    expect(parseAppLocation("/w/ws1", new URLSearchParams("tab=nle"))).toEqual({
      mainArea: "workspace",
      workspaceId: "ws1",
      workspaceTab: "chat",
    });
  });

  test("area query", () => {
    expect(parseAppLocation("/", new URLSearchParams("area=notebook"))).toEqual({
      mainArea: "notebook",
      workspaceId: null,
      workspaceTab: "chat",
    });
  });

  test("bare slash is global chat", () => {
    expect(parseAppLocation("/", new URLSearchParams())).toEqual({
      mainArea: "chat",
      workspaceId: null,
      workspaceTab: "chat",
    });
  });
});

describe("pathFor", () => {
  test("workspace chat omits tab query", () => {
    expect(pathFor("workspace", "ws1", "chat")).toBe("/w/ws1");
    expect(pathFor("workspace", "ws1", "code")).toBe("/w/ws1?tab=code");
  });

  test("home and chat share /", () => {
    expect(pathFor("chat", null, "chat")).toBe("/");
    expect(pathFor("home", null, "chat")).toBe("/");
  });
});
