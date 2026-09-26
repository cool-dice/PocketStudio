import { describe, expect, test } from "bun:test";

import {
  BELL_CLEARED,
  BELL_CLEAR,
  BELL_EMPTY,
  BELL_EMPTY_HINT,
  BELL_LOAD_ERROR,
  BELL_LOAD_ERROR_HINT,
  BELL_MARK_ALL_READ,
  BELL_RETRY,
  bellListView,
  reminderToastId,
  shouldToastNewReminder,
} from "./notification-copy";

describe("bell empty vs error copy", () => {
  test("load error is not the empty-bell message", () => {
    expect(BELL_LOAD_ERROR).not.toBe(BELL_EMPTY);
    expect(BELL_LOAD_ERROR).not.toMatch(/пока тихо/i);
    expect(BELL_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(BELL_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(BELL_EMPTY_HINT).toMatch(/[А-Яа-яЁё]/);
    expect(BELL_EMPTY_HINT).toMatch(/воркспейс/i);
    expect(BELL_EMPTY_HINT).toMatch(/чекпоинт/i);
    expect(BELL_EMPTY_HINT).not.toMatch(/код-проект/i);
    expect(BELL_LOAD_ERROR).toMatch(/[А-Яа-яЁё]/);
    expect(BELL_RETRY).toMatch(/повторить/i);
    expect(BELL_MARK_ALL_READ).toMatch(/прочитанн/i);
    expect(BELL_CLEAR).toMatch(/очистить/i);
    expect(BELL_CLEARED).toMatch(/очищен/i);
  });

  test("failed load is error, not empty; successful [] is empty", () => {
    expect(bellListView(false, BELL_LOAD_ERROR, 0)).toBe("error");
    expect(bellListView(true, BELL_LOAD_ERROR, 3)).toBe("error");
    expect(bellListView(true, null, 0)).toBe("empty");
    expect(bellListView(false, null, 0)).toBe("loading");
    expect(bellListView(true, null, 2)).toBe("ready");
  });
});

describe("reminder toast dedupe", () => {
  test("toast id is stable per note so a second poll does not stack", () => {
    expect(reminderToastId("note-1")).toBe("reminder-note-1");
    expect(reminderToastId("note-1")).toBe(reminderToastId("note-1"));
    expect(reminderToastId("note-2")).not.toBe(reminderToastId("note-1"));
  });

  test("WS bell push does not toast; only the due-reminders poller does", () => {
    expect(shouldToastNewReminder("poll")).toBe(true);
    expect(shouldToastNewReminder("ws")).toBe(false);
  });
});
