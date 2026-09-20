import { describe, expect, test } from "bun:test";

import {
  VIDEO_STORYBOARD_EMPTY_HINT,
  VIDEO_STORYBOARD_EMPTY_TITLE,
  VIDEO_STORYBOARD_LOAD_ERROR,
  VIDEO_STORYBOARD_NO_SCENES,
  VIDEO_STORYBOARD_NOTHING_TO_WATCH,
  storyboardListView,
} from "./video-copy";

describe("storyboard empty vs error", () => {
  test("load error is not the create-script empty state", () => {
    expect(VIDEO_STORYBOARD_LOAD_ERROR).not.toBe(VIDEO_STORYBOARD_EMPTY_TITLE);
    expect(VIDEO_STORYBOARD_EMPTY_TITLE).toMatch(/сценарий/i);
    expect(VIDEO_STORYBOARD_LOAD_ERROR).toMatch(/не удалось загрузить/i);
    expect(VIDEO_STORYBOARD_NO_SCENES).not.toBe(VIDEO_STORYBOARD_LOAD_ERROR);
    expect(VIDEO_STORYBOARD_NOTHING_TO_WATCH).not.toBe(
      VIDEO_STORYBOARD_LOAD_ERROR,
    );
    expect(VIDEO_STORYBOARD_EMPTY_HINT).toMatch(/сцен/i);
  });

  test("null scripts is loading, [] is empty, error wins", () => {
    expect(storyboardListView(null, null)).toBe("loading");
    expect(storyboardListView([], null)).toBe("empty");
    expect(storyboardListView([], "Не удалось загрузить сценарии")).toBe("error");
    expect(storyboardListView([{ id: "s1" }], "boom")).toBe("error");
    expect(storyboardListView([{ id: "s1" }], null)).toBe("ready");
  });
});
