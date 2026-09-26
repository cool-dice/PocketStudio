/**
 * Honest bell copy. A failed load is not «Пока тихо»;
 * reminder toasts come from the due-notes poller only.
 */

export const BELL_EMPTY = "Пока тихо";
export const BELL_EMPTY_HINT =
  "Здесь появятся готовые анализы, напоминания из блокнота, воркспейсы и чекпоинты";

export const BELL_LOAD_ERROR = "Не удалось загрузить уведомления";
export const BELL_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой список.";
export const BELL_RETRY = "Повторить";

export const BELL_MARK_ALL_READ = "Отметить все прочитанными";
export const BELL_CLEAR = "Очистить историю уведомлений";
export const BELL_CLEARED = "История уведомлений очищена";

export type BellListView = "loading" | "error" | "empty" | "ready";

export function bellListView(
  loaded: boolean,
  loadError: string | null,
  count: number,
): BellListView {
  if (loadError) return "error";
  if (!loaded) return "loading";
  if (count === 0) return "empty";
  return "ready";
}

/** Stable sonner id — a second poll for the same note replaces, not stacks. */
export function reminderToastId(noteId: string): string {
  return `reminder-${noteId}`;
}

export type ReminderToastSource = "poll" | "ws";

/**
 * Only the due-reminders poller toasts. `notification:new` already lands in
 * the bell — toasting it would duplicate the poller's reminder toast.
 */
export function shouldToastNewReminder(source: ReminderToastSource): boolean {
  return source === "poll";
}
