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
  THREAD_ARCHIVED_SEND,
  THREAD_LOAD_FAILED,
  THREAD_NOT_FOUND,
  composerSendGuard,
  composerTargetAfterArchive,
  composerTargetAfterDelete,
  isThreadComposerSurface,
  isThreadLookupError,
  nextThreadIdAfterDelete,
  renamedTitle,
  resolveSendThreadId,
  shouldToastThreadLookupError,
  sidebarThreadsAfterArchive,
  sidebarThreadsAfterDelete,
  threadArchiveToast,
  threadLookupError,
  threadsEmptyCopy,
  threadsListView,
  workspaceThreadBindAction,
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

describe("send-guard: archived thread refuses instead of hanging", () => {
  test("archived active thread is a Russian refuse, not a new send id", () => {
    const known = ["arch"];
    expect(
      composerSendGuard({
        activeId: "arch",
        knownIds: known,
        deletedIds: [],
        archived: true,
      }),
    ).toEqual({ ok: false, message: THREAD_ARCHIVED_SEND });
    expect(THREAD_ARCHIVED_SEND).toMatch(/[А-Яа-яЁё]/);
    expect(THREAD_ARCHIVED_SEND).toMatch(/архив/i);
    expect(THREAD_ARCHIVED_SEND).not.toBe(THREADS_ARCHIVED);
    expect(THREAD_ARCHIVED_SEND).not.toMatch(/отправляется/i);
  });

  test("live thread still resolves; missing id still means create-new", () => {
    expect(
      composerSendGuard({
        activeId: "live",
        knownIds: ["live"],
        deletedIds: [],
        archived: false,
      }),
    ).toEqual({ ok: true, threadId: "live" });
    expect(
      composerSendGuard({
        activeId: null,
        knownIds: [],
        deletedIds: [],
        archived: false,
      }),
    ).toEqual({ ok: true, threadId: null });
    expect(
      composerSendGuard({
        activeId: "gone",
        knownIds: ["live"],
        deletedIds: ["gone"],
        archived: false,
      }),
    ).toEqual({ ok: true, threadId: null });
  });

  test("server send rejects archived; join still finds the row", () => {
    const row = { userId: "u1", archived: true };
    expect(threadLookupError(null, "u1")).toBe(THREAD_NOT_FOUND);
    expect(threadLookupError({ userId: "other" }, "u1")).toBe(THREAD_NOT_FOUND);
    expect(threadLookupError(row, "u1")).toBeNull();
    expect(threadLookupError(row, "u1", { rejectArchived: true })).toBe(
      THREAD_ARCHIVED_SEND,
    );
    expect(
      threadLookupError({ userId: "u1", archived: false }, "u1", {
        rejectArchived: true,
      }),
    ).toBeNull();
  });
});

describe("workspace thread bind vs film/video lookup toast", () => {
  test("video/storyboard is not a composer surface", () => {
    expect(
      isThreadComposerSurface({ mainArea: "workspace", workspaceTab: "video" }),
    ).toBe(false);
    expect(
      isThreadComposerSurface({ mainArea: "workspace", workspaceTab: "chat" }),
    ).toBe(true);
    expect(isThreadComposerSurface({ mainArea: "chat" })).toBe(true);
    expect(isThreadComposerSurface({ mainArea: "home" })).toBe(true);
    expect(isThreadComposerSurface({ mainArea: "video" })).toBe(false);
  });

  test("missing global thread does not toast on /w/{id}?tab=video", () => {
    expect(isThreadLookupError(THREAD_NOT_FOUND)).toBe(true);
    expect(isThreadLookupError(THREAD_LOAD_FAILED)).toBe(true);
    expect(isThreadLookupError("Нет соединения")).toBe(false);
    expect(
      shouldToastThreadLookupError(THREAD_NOT_FOUND, {
        mainArea: "workspace",
        workspaceTab: "video",
      }),
    ).toBe(false);
    expect(
      shouldToastThreadLookupError(THREAD_NOT_FOUND, {
        mainArea: "chat",
      }),
    ).toBe(true);
    expect(
      shouldToastThreadLookupError("Агент ещё отвечает…", {
        mainArea: "workspace",
        workspaceTab: "video",
      }),
    ).toBe(true);
  });

  test("bind picks the live workspace thread or creates; skips archived", () => {
    const rows = [
      { id: "global", projectId: null, archived: false },
      { id: "old", projectId: "ws1", archived: true },
      { id: "live", projectId: "ws1", archived: false },
    ];
    expect(workspaceThreadBindAction("ws1", "ws1", rows)).toEqual({
      action: "noop",
    });
    expect(workspaceThreadBindAction("ws1", null, rows)).toEqual({
      action: "select",
      threadId: "live",
    });
    expect(workspaceThreadBindAction("ws1", "other", rows)).toEqual({
      action: "select",
      threadId: "live",
    });
    expect(workspaceThreadBindAction("ws-new", null, rows)).toEqual({
      action: "create",
    });
    expect(
      workspaceThreadBindAction("ws1", null, [
        { id: "old", projectId: "ws1", archived: true },
      ]),
    ).toEqual({ action: "create" });
  });
});

describe("rename persist", () => {
  test("title follows the PATCH body; a failed rename keeps the previous title", () => {
    expect(renamedTitle(true, "Старое", "Новое имя")).toBe("Новое имя");
    expect(renamedTitle(false, "Старое", "Новое имя")).toBe("Старое");
  });
});
