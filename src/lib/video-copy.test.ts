import { describe, expect, test } from "bun:test";

import {
  STORYBOARD_SEED_SCENE_COUNT,
  VIDEO_STORYBOARD_CREATE_FAILED,
  VIDEO_STORYBOARD_CREATED,
  VIDEO_STORYBOARD_EMPTY_HEADING,
  VIDEO_STORYBOARD_EMPTY_HINT,
  VIDEO_STORYBOARD_EMPTY_TITLE,
  VIDEO_STORYBOARD_LOAD_ERROR,
  VIDEO_STORYBOARD_NO_SCENES,
  VIDEO_STORYBOARD_NOTHING_TO_WATCH,
  storyboardListView,
  storyboardSeedSceneTitles,
  storyboardShowsScriptChips,
} from "./video-copy";

describe("storyboard empty vs error", () => {
  test("load error is not the create-script empty state", () => {
    expect(VIDEO_STORYBOARD_LOAD_ERROR).not.toBe(VIDEO_STORYBOARD_EMPTY_TITLE);
    expect(VIDEO_STORYBOARD_EMPTY_TITLE).toBe("Создать сценарий раскадровки");
    expect(VIDEO_STORYBOARD_EMPTY_HEADING).toMatch(/пока нет/i);
    expect(VIDEO_STORYBOARD_EMPTY_HEADING).not.toBe(VIDEO_STORYBOARD_LOAD_ERROR);
    expect(VIDEO_STORYBOARD_LOAD_ERROR).toMatch(/не удалось загрузить/i);
    expect(VIDEO_STORYBOARD_NO_SCENES).not.toBe(VIDEO_STORYBOARD_LOAD_ERROR);
    expect(VIDEO_STORYBOARD_NOTHING_TO_WATCH).not.toBe(
      VIDEO_STORYBOARD_LOAD_ERROR,
    );
    expect(VIDEO_STORYBOARD_EMPTY_HINT).toMatch(/сцен/i);
    expect(VIDEO_STORYBOARD_CREATE_FAILED).not.toBe(VIDEO_STORYBOARD_CREATED);
    expect(VIDEO_STORYBOARD_CREATE_FAILED).not.toMatch(/пока нет/i);
  });

  test("null scripts is loading, [] is empty, error wins", () => {
    expect(storyboardListView(null, null)).toBe("loading");
    expect(storyboardListView([], null)).toBe("empty");
    expect(storyboardListView([], "Не удалось загрузить сценарии")).toBe("error");
    expect(storyboardListView([{ id: "s1" }], "boom")).toBe("error");
    expect(storyboardListView([{ id: "s1" }], null)).toBe("ready");
  });

  test("script chips render only when a scenario exists", () => {
    expect(storyboardShowsScriptChips("loading")).toBe(false);
    expect(storyboardShowsScriptChips("empty")).toBe(false);
    expect(storyboardShowsScriptChips("error")).toBe(false);
    expect(storyboardShowsScriptChips("ready")).toBe(true);
  });

  test("new storyboard seeds four titled scenes, not ghost chips", () => {
    expect(STORYBOARD_SEED_SCENE_COUNT).toBe(4);
    expect(storyboardSeedSceneTitles()).toEqual([
      "Сцена 1",
      "Сцена 2",
      "Сцена 3",
      "Сцена 4",
    ]);
  });
});
