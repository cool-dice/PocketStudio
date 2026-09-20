/**
 * Honest storyboard empty vs error. A failed fetch is not «создать сценарий».
 */

export const VIDEO_STORYBOARD_LOAD_ERROR = "Не удалось загрузить сценарии";
export const VIDEO_STORYBOARD_EMPTY_TITLE = "Создать сценарий раскадровки";
export const VIDEO_STORYBOARD_EMPTY_HINT =
  "Сценарий — это список сцен. В каждой сцене: текст для диктора, сгенерированный кадр и озвучка. Из них плеер соберёт фильм.";
export const VIDEO_STORYBOARD_NO_SCENES = "В сценарии пока нет ни одной сцены";
export const VIDEO_STORYBOARD_NOTHING_TO_WATCH =
  "Пока нечего смотреть — сгенерируйте кадр или озвучку любой сцены";

export type StoryboardListView = "loading" | "error" | "empty" | "ready";

export function storyboardListView(
  scripts: unknown[] | null,
  loadError: string | null,
): StoryboardListView {
  if (loadError) return "error";
  if (scripts === null) return "loading";
  if (scripts.length === 0) return "empty";
  return "ready";
}
