import { describe, expect, test } from "bun:test";

import { notesListViewState } from "./notes-list-state";

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
