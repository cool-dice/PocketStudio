import { describe, expect, test } from "bun:test";

import { parseAppLocation, pathFor } from "./app-url";

describe("parseAppLocation", () => {
  test("workspace path with tab", () => {
    expect(parseAppLocation("/w/ws1", new URLSearchParams("tab=documents"))).toEqual({
      mainArea: "workspace",
      workspaceId: "ws1",
      workspaceTab: "documents",
      workspaceDocId: null,
    });
  });

  test("documents tab restores last doc from query", () => {
    expect(
      parseAppLocation("/w/ws1", new URLSearchParams("tab=documents&doc=clastworkdoc01")),
    ).toEqual({
      mainArea: "workspace",
      workspaceId: "ws1",
      workspaceTab: "documents",
      workspaceDocId: "clastworkdoc01",
    });
  });

  test("doc query is ignored on other tabs", () => {
    expect(parseAppLocation("/w/ws1", new URLSearchParams("tab=chat&doc=clastworkdoc01"))).toEqual(
      {
        mainArea: "workspace",
        workspaceId: "ws1",
        workspaceTab: "chat",
        workspaceDocId: null,
      },
    );
  });

  test("unknown tab falls back to chat", () => {
    expect(parseAppLocation("/w/ws1", new URLSearchParams("tab=nle"))).toEqual({
      mainArea: "workspace",
      workspaceId: "ws1",
      workspaceTab: "chat",
      workspaceDocId: null,
    });
  });

  test("area query", () => {
    expect(parseAppLocation("/", new URLSearchParams("area=notebook"))).toEqual({
      mainArea: "notebook",
      workspaceId: null,
      workspaceTab: "chat",
      workspaceDocId: null,
    });
  });

  test("bare slash is global chat", () => {
    expect(parseAppLocation("/", new URLSearchParams())).toEqual({
      mainArea: "chat",
      workspaceId: null,
      workspaceTab: "chat",
      workspaceDocId: null,
    });
  });
});

describe("pathFor", () => {
  test("workspace chat omits tab query", () => {
    expect(pathFor("workspace", "ws1", "chat")).toBe("/w/ws1");
    expect(pathFor("workspace", "ws1", "code")).toBe("/w/ws1?tab=code");
  });

  test("documents tab keeps last doc in the URL", () => {
    expect(pathFor("workspace", "ws1", "documents", "clastworkdoc01")).toBe(
      "/w/ws1?tab=documents&doc=clastworkdoc01",
    );
  });

  test("home and chat share /", () => {
    expect(pathFor("chat", null, "chat")).toBe("/");
    expect(pathFor("home", null, "chat")).toBe("/");
  });
});
