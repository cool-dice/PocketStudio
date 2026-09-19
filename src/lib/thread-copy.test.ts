import { describe, expect, test } from "bun:test";

import {
  THREADS_DELETE_FAILED,
  THREADS_EMPTY,
  THREADS_EMPTY_HINT,
  THREADS_LOAD_ERROR,
  THREADS_LOAD_ERROR_HINT,
  THREADS_RENAME_FAILED,
  THREADS_RETRY,
  composerTargetAfterDelete,
  nextThreadIdAfterDelete,
  renamedTitle,
  resolveSendThreadId,
  sidebarThreadsAfterDelete,
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
