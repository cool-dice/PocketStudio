import { describe, expect, test } from "bun:test";

import {
  notebookFeedView,
  noteDetailSurface,
  notesListViewState,
} from "./notes-list-state";

describe("notesListViewState", () => {
  test("another workspace's notes are loading, not empty", () => {
    expect(notesListViewState("ws-b", "ws-a", null)).toBe("loading");
    expect(notesListViewState("ws-b", null, null)).toBe("loading");
  });

  test("another workspace's error is not this tab's empty list", () => {
    expect(notesListViewState("ws-b", "ws-a", "ws-a")).toBe("loading");
  });

  test("this workspace's fetch error is error, not empty", () => {
    expect(notesListViewState("ws-a", "ws-a", "ws-a")).toBe("error");
    expect(notesListViewState("ws-a", null, "ws-a")).toBe("error");
  });

  test("this workspace ready after a successful load", () => {
    expect(notesListViewState("ws-a", "ws-a", null)).toBe("ready");
  });
});

describe("notebookFeedView", () => {
  test("load error is error, not empty", () => {
    expect(notebookFeedView(false, "Не удалось загрузить заметки", 0)).toBe("error");
    expect(notebookFeedView(false, "Не удалось загрузить заметки", 3)).toBe("error");
  });

  test("successful empty list is empty, not error", () => {
    expect(notebookFeedView(false, null, 0)).toBe("empty");
  });

  test("loading beats empty and error", () => {
    expect(notebookFeedView(true, null, 0)).toBe("loading");
    expect(notebookFeedView(true, "err", 0)).toBe("loading");
  });

  test("notes after a successful load are ready", () => {
    expect(notebookFeedView(false, null, 2)).toBe("ready");
  });
});

describe("noteDetailSurface", () => {
  test("workspace opens a dialog on desktop — context rail is chat/notebook only", () => {
    expect(noteDetailSurface("workspace", false)).toBe("dialog");
    expect(noteDetailSurface("documents", false)).toBe("dialog");
    expect(noteDetailSurface("chat", false)).toBe("context-panel");
    expect(noteDetailSurface("notebook", false)).toBe("context-panel");
  });

  test("narrow viewports always use the dialog", () => {
    expect(noteDetailSurface("chat", true)).toBe("dialog");
    expect(noteDetailSurface("notebook", true)).toBe("dialog");
    expect(noteDetailSurface("workspace", true)).toBe("dialog");
  });
});
