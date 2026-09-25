import { describe, expect, test } from "bun:test";

import {
  hrefFromLocation,
  isSidebarChatActive,
  parseAppLocation,
  pathFor,
  sidebarChatLocation,
} from "./app-url";

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

describe("sidebar Chat nav vs workspace URL", () => {
  test("from /w/{id} Code stays on scoped chat, not global /", () => {
    const inside = sidebarChatLocation({
      mainArea: "workspace",
      workspaceId: "ws1",
      workspaceTab: "code",
      workspaceDocId: null,
    });
    expect(inside).toEqual({
      mainArea: "workspace",
      workspaceId: "ws1",
      workspaceTab: "chat",
      workspaceDocId: null,
    });
    expect(hrefFromLocation(inside)).toBe("/w/ws1");
    expect(hrefFromLocation(inside)).not.toBe("/");
  });

  test("from Home / other areas opens the unbound orchestrator", () => {
    expect(
      hrefFromLocation(
        sidebarChatLocation({
          mainArea: "home",
          workspaceId: null,
          workspaceTab: "chat",
          workspaceDocId: null,
        }),
      ),
    ).toBe("/");
    expect(
      hrefFromLocation(
        sidebarChatLocation({
          mainArea: "notebook",
          workspaceId: null,
          workspaceTab: "chat",
          workspaceDocId: null,
        }),
      ),
    ).toBe("/");
  });

  test("Chat is active on global chat and workspace chat tab only", () => {
    expect(
      isSidebarChatActive({
        mainArea: "chat",
        workspaceId: null,
        workspaceTab: "chat",
        workspaceDocId: null,
      }),
    ).toBe(true);
    expect(
      isSidebarChatActive({
        mainArea: "workspace",
        workspaceId: "ws1",
        workspaceTab: "chat",
        workspaceDocId: null,
      }),
    ).toBe(true);
    expect(
      isSidebarChatActive({
        mainArea: "workspace",
        workspaceId: "ws1",
        workspaceTab: "code",
        workspaceDocId: null,
      }),
    ).toBe(false);
    expect(
      isSidebarChatActive({
        mainArea: "home",
        workspaceId: null,
        workspaceTab: "chat",
        workspaceDocId: null,
      }),
    ).toBe(false);
  });
});
