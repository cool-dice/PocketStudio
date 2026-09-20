import { describe, expect, test } from "bun:test";

import {
  THREADS_ARCHIVE_ACTION,
  THREADS_ARCHIVE_EMPTY,
  THREADS_ARCHIVE_EMPTY_HINT,
  THREADS_ARCHIVE_FAILED,
  THREADS_ARCHIVED,
  THREADS_DELETE_FAILED,
  THREADS_EMPTY,
  THREADS_EMPTY_HINT,
  THREADS_HIDE_ARCHIVE,
  THREADS_LOAD_ERROR,
  THREADS_LOAD_ERROR_HINT,
  THREADS_RENAME_FAILED,
  THREADS_RESTORED,
  THREADS_RETRY,
  THREADS_SHOW_ARCHIVE,
  THREADS_UNARCHIVE_ACTION,
  THREADS_UNARCHIVE_FAILED,
  composerTargetAfterArchive,
  composerTargetAfterDelete,
  nextThreadIdAfterDelete,
  renamedTitle,
  resolveSendThreadId,
  sidebarThreadsAfterArchive,
  sidebarThreadsAfterDelete,
  threadArchiveToast,
  threadsEmptyCopy,
  threadsListView,
} from "./thread-copy";

describe("thread list empty vs error copy", () => {
  test("load error is not the empty-list message", () => {
    expect(THREADS_LOAD_ERROR).not.toBe(THREADS_EMPTY);
    expect(THREADS_LOAD_ERROR).not.toMatch(/пока нет/i);
    expect(THREADS_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(THREADS_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(THREADS_EMPTY_HINT).toMatch(/[А-Яа-яЁё]/);
    expect(THREADS_LOAD_ERROR).toMatch(/[А-Яа-яЁё]/);
    expect(THREADS_RETRY).toMatch(/повторить/i);
    expect(THREADS_DELETE_FAILED).toMatch(/не удалось удалить/i);
    expect(THREADS_RENAME_FAILED).toMatch(/не удалось переименовать/i);
    expect(THREADS_DELETE_FAILED).not.toMatch(/удалён|удален/i);
  });

  test("failed load is error, not empty; successful [] is empty", () => {
    expect(threadsListView(false, THREADS_LOAD_ERROR, 0)).toBe("error");
    expect(threadsListView(false, THREADS_LOAD_ERROR, 3)).toBe("error");
    expect(threadsListView(true, null, 0)).toBe("loading");
    expect(threadsListView(true, THREADS_LOAD_ERROR, 0)).toBe("loading");
    expect(threadsListView(false, null, 0)).toBe("empty");
    expect(threadsListView(false, null, 2)).toBe("ready");
  });

  test("archive empty copy is not the load error", () => {
    expect(THREADS_ARCHIVE_EMPTY).not.toBe(THREADS_LOAD_ERROR);
    expect(THREADS_ARCHIVE_EMPTY).not.toMatch(/не удалось/i);
    expect(THREADS_LOAD_ERROR).not.toMatch(/в архиве пока нет/i);
    expect(THREADS_ARCHIVE_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(THREADS_ARCHIVE_EMPTY_HINT).toMatch(/[А-Яа-яЁё]/);
    expect(THREADS_SHOW_ARCHIVE).toBe("Показать архив");
    expect(THREADS_HIDE_ARCHIVE).toMatch(/скрыть архив/i);
    const liveEmpty = threadsEmptyCopy(false);
    const archiveEmpty = threadsEmptyCopy(true);
    expect(liveEmpty.title).toBe(THREADS_EMPTY);
    expect(archiveEmpty.title).toBe(THREADS_ARCHIVE_EMPTY);
    expect(archiveEmpty.title).not.toBe(liveEmpty.title);
    expect(threadsListView(false, THREADS_LOAD_ERROR, 0)).toBe("error");
    expect(threadsListView(false, null, 0)).toBe("empty");
  });
});

describe("archive honesty: toast after PATCH, sidebar filter", () => {
  test("success toast only when ok — never before the API", () => {
    expect(threadArchiveToast(false, true)).toEqual({
      kind: "error",
      message: THREADS_ARCHIVE_FAILED,
    });
    expect(threadArchiveToast(false, false)).toEqual({
      kind: "error",
      message: THREADS_UNARCHIVE_FAILED,
    });
    expect(threadArchiveToast(true, true)).toEqual({
      kind: "success",
      message: THREADS_ARCHIVED,
    });
    expect(threadArchiveToast(true, false)).toEqual({
      kind: "success",
      message: THREADS_RESTORED,
    });
    expect(THREADS_ARCHIVE_FAILED).toMatch(/не удалось архивировать/i);
    expect(THREADS_UNARCHIVE_FAILED).toMatch(/не удалось вернуть/i);
    expect(THREADS_ARCHIVED).toMatch(/в архиве/i);
    expect(THREADS_RESTORED).toMatch(/возвращ/i);
    expect(THREADS_ARCHIVE_ACTION).toMatch(/архивировать/i);
    expect(THREADS_UNARCHIVE_ACTION).toMatch(/вернуть из архива/i);
    expect(threadArchiveToast(false, true).kind).not.toBe("success");
    expect(THREADS_ARCHIVE_FAILED).not.toMatch(/в архиве$/i);
  });

  test("failed PATCH keeps every row; success hides from the other view", () => {
    const live = [
      { id: "a", archived: false },
      { id: "b", archived: false },
    ];
    expect(sidebarThreadsAfterArchive(live, "a", true, false, false)).toEqual(
      live,
    );
    expect(
      sidebarThreadsAfterArchive(live, "a", true, false, true).map((t) => t.id),
    ).toEqual(["b"]);

    const archived = [
      { id: "a", archived: true },
      { id: "b", archived: true },
    ];
    expect(
      sidebarThreadsAfterArchive(archived, "a", false, true, false),
    ).toEqual(archived);
    expect(
      sidebarThreadsAfterArchive(archived, "a", false, true, true).map(
        (t) => t.id,
      ),
    ).toEqual(["b"]);
  });

  test("composer leaves the archived row only after it drops from this list", () => {
    expect(
      composerTargetAfterArchive("a", "a", ["a", "b"], false),
    ).toBe("a");
    expect(
      composerTargetAfterArchive("a", "a", ["a", "b"], true),
    ).toBe("b");
    expect(composerTargetAfterArchive("a", "a", ["a"], true)).toBeNull();
    expect(
      composerTargetAfterArchive("b", "a", ["a", "b"], true),
    ).toBe("b");
  });
});

describe("delete honesty: sidebar + composer", () => {
  test("failed DELETE keeps every row — no fake success", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(sidebarThreadsAfterDelete(rows, "a", false)).toEqual(rows);
    expect(sidebarThreadsAfterDelete(rows, "a", true).map((t) => t.id)).toEqual([
      "b",
    ]);
  });

  test("deleting the active thread leaves the composer on the next one, or none", () => {
    expect(nextThreadIdAfterDelete(["gone", "keep"], "gone")).toBe("keep");
    expect(nextThreadIdAfterDelete(["gone"], "gone")).toBeNull();
    expect(composerTargetAfterDelete("gone", "gone", ["gone", "keep"])).toBe(
      "keep",
    );
    expect(composerTargetAfterDelete("gone", "gone", ["gone"])).toBeNull();
    expect(composerTargetAfterDelete("keep", "gone", ["gone", "keep"])).toBe(
      "keep",
    );
  });

  test("composer does not send to a deleted or unknown thread id", () => {
    const known = ["live"];
    const deleted = new Set(["gone"]);
    expect(resolveSendThreadId("gone", known, deleted)).toBeNull();
    expect(resolveSendThreadId("ghost", known, deleted)).toBeNull();
    expect(resolveSendThreadId("live", known, deleted)).toBe("live");
    expect(resolveSendThreadId(null, known, deleted)).toBeNull();
  });
});

describe("rename persist", () => {
  test("title follows the PATCH body; a failed rename keeps the previous title", () => {
    expect(renamedTitle(true, "Старое", "Новое имя")).toBe("Новое имя");
    expect(renamedTitle(false, "Старое", "Новое имя")).toBe("Старое");
  });
});
