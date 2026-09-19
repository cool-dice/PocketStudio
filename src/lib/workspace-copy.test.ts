import { describe, expect, test } from "bun:test";

import {
  WORKSPACES_ARCHIVE_ACTION,
  WORKSPACES_ARCHIVE_EMPTY,
  WORKSPACES_ARCHIVE_EMPTY_HINT,
  WORKSPACES_ARCHIVE_FAILED,
  WORKSPACES_ARCHIVED,
  WORKSPACES_EMPTY,
  WORKSPACES_EMPTY_HINT,
  WORKSPACES_FAVORITE_FAILED,
  WORKSPACES_HIDE_ARCHIVE,
  WORKSPACES_LOAD_ERROR,
  WORKSPACES_LOAD_ERROR_HINT,
  WORKSPACES_RESTORED,
  WORKSPACES_RETRY,
  WORKSPACES_SHOW_ARCHIVE,
  WORKSPACES_UNARCHIVE_ACTION,
  WORKSPACES_UNARCHIVE_FAILED,
  gridWorkspacesAfterArchive,
  gridWorkspacesAfterFavorite,
  workspaceArchiveToast,
  workspacesEmptyCopy,
  workspacesListQuery,
  workspacesListSearch,
  workspacesListView,
} from "./workspace-copy";

describe("workspace grid empty vs error copy", () => {
  test("load error is not the empty-list message", () => {
    expect(WORKSPACES_LOAD_ERROR).not.toBe(WORKSPACES_EMPTY);
    expect(WORKSPACES_LOAD_ERROR).not.toMatch(/пока нет/i);
    expect(WORKSPACES_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(WORKSPACES_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(WORKSPACES_EMPTY_HINT).toMatch(/[А-Яа-яЁё]/);
    expect(WORKSPACES_LOAD_ERROR).toMatch(/[А-Яа-яЁё]/);
    expect(WORKSPACES_RETRY).toMatch(/повторить/i);
  });

  test("failed load is error, not empty; successful [] is empty", () => {
    expect(workspacesListView(false, WORKSPACES_LOAD_ERROR, 0)).toBe("error");
    expect(workspacesListView(false, true, 0)).toBe("error");
    expect(workspacesListView(false, WORKSPACES_LOAD_ERROR, 3)).toBe("error");
    expect(workspacesListView(true, null, 0)).toBe("loading");
    expect(workspacesListView(true, WORKSPACES_LOAD_ERROR, 0)).toBe("loading");
    expect(workspacesListView(false, null, 0)).toBe("empty");
    expect(workspacesListView(false, false, 0)).toBe("empty");
    expect(workspacesListView(false, null, 2)).toBe("ready");
  });

  test("archive empty copy is not the load error", () => {
    expect(WORKSPACES_ARCHIVE_EMPTY).not.toBe(WORKSPACES_LOAD_ERROR);
    expect(WORKSPACES_ARCHIVE_EMPTY).not.toMatch(/не удалось/i);
    expect(WORKSPACES_LOAD_ERROR).not.toMatch(/в архиве пока нет/i);
    expect(WORKSPACES_ARCHIVE_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(WORKSPACES_ARCHIVE_EMPTY_HINT).toMatch(/[А-Яа-яЁё]/);
    expect(WORKSPACES_SHOW_ARCHIVE).toBe("Показать архив");
    expect(WORKSPACES_HIDE_ARCHIVE).toMatch(/скрыть архив/i);
    const liveEmpty = workspacesEmptyCopy(false);
    const archiveEmpty = workspacesEmptyCopy(true);
    expect(liveEmpty.title).toBe(WORKSPACES_EMPTY);
    expect(archiveEmpty.title).toBe(WORKSPACES_ARCHIVE_EMPTY);
    expect(archiveEmpty.title).not.toBe(liveEmpty.title);
    expect(workspacesListView(false, WORKSPACES_LOAD_ERROR, 0)).toBe("error");
    expect(workspacesListView(false, null, 0)).toBe("empty");
  });
});

describe("archive honesty: toast after PATCH, grid filter, query", () => {
  test("default list has no archived query; toggle is ?archived=1", () => {
    expect(workspacesListQuery(false)).toEqual({});
    expect(workspacesListQuery(true)).toEqual({ archived: true });
    expect(workspacesListSearch(false)).toBe("");
    expect(workspacesListSearch(true)).toBe("?archived=1");
  });

  test("success toast only when ok — never before the API", () => {
    expect(workspaceArchiveToast(false, true)).toEqual({
      kind: "error",
      message: WORKSPACES_ARCHIVE_FAILED,
    });
    expect(workspaceArchiveToast(false, false)).toEqual({
      kind: "error",
      message: WORKSPACES_UNARCHIVE_FAILED,
    });
    expect(workspaceArchiveToast(true, true)).toEqual({
      kind: "success",
      message: WORKSPACES_ARCHIVED,
    });
    expect(workspaceArchiveToast(true, false)).toEqual({
      kind: "success",
      message: WORKSPACES_RESTORED,
    });
    expect(WORKSPACES_ARCHIVE_FAILED).toMatch(/не удалось архивировать/i);
    expect(WORKSPACES_UNARCHIVE_FAILED).toMatch(/не удалось вернуть/i);
    expect(WORKSPACES_ARCHIVED).toMatch(/в архиве/i);
    expect(WORKSPACES_RESTORED).toMatch(/возвращ/i);
    expect(WORKSPACES_ARCHIVE_ACTION).toMatch(/архивировать/i);
    expect(WORKSPACES_UNARCHIVE_ACTION).toMatch(/вернуть из архива/i);
    expect(workspaceArchiveToast(false, true).kind).not.toBe("success");
    expect(WORKSPACES_ARCHIVE_FAILED).not.toMatch(/в архиве$/i);
  });

  test("failed PATCH keeps every card; success hides from the other view", () => {
    const live = [
      { id: "a", archived: false },
      { id: "b", archived: false },
    ];
    expect(gridWorkspacesAfterArchive(live, "a", true, false, false)).toEqual(
      live,
    );
    expect(
      gridWorkspacesAfterArchive(live, "a", true, false, true).map((w) => w.id),
    ).toEqual(["b"]);

    const archived = [
      { id: "a", archived: true },
      { id: "b", archived: true },
    ];
    expect(
      gridWorkspacesAfterArchive(archived, "a", false, true, false),
    ).toEqual(archived);
    expect(
      gridWorkspacesAfterArchive(archived, "a", false, true, true).map(
        (w) => w.id,
      ),
    ).toEqual(["b"]);
  });
});

describe("favorites stay independent of the archive toggle", () => {
  test("failed favorite PATCH keeps the previous star", () => {
    const live = [
      { id: "a", favorite: false, archived: false },
      { id: "b", favorite: true, archived: false },
    ];
    expect(gridWorkspacesAfterFavorite(live, "a", true, false)).toEqual(live);
    expect(WORKSPACES_FAVORITE_FAILED).toMatch(/не удалось обновить избранное/i);
  });

  test("success updates the star and never drops the card or flips archived", () => {
    const live = [
      { id: "a", favorite: false, archived: false },
      { id: "b", favorite: true, archived: false },
    ];
    expect(gridWorkspacesAfterFavorite(live, "a", true, true)).toEqual([
      { id: "a", favorite: true, archived: false },
      { id: "b", favorite: true, archived: false },
    ]);

    const archived = [{ id: "a", favorite: false, archived: true }];
    expect(gridWorkspacesAfterFavorite(archived, "a", true, true)).toEqual([
      { id: "a", favorite: true, archived: true },
    ]);
    expect(
      gridWorkspacesAfterFavorite(archived, "a", true, true)[0]?.archived,
    ).toBe(true);
  });

  test("starring does not hide a live card the way archive does", () => {
    const live = [{ id: "a", favorite: false, archived: false }];
    const afterStar = gridWorkspacesAfterFavorite(live, "a", true, true);
    expect(afterStar.map((w) => w.id)).toEqual(["a"]);
    expect(
      gridWorkspacesAfterArchive(live, "a", true, false, true).map((w) => w.id),
    ).toEqual([]);
  });
});
