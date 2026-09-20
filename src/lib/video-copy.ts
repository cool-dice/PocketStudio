/**
 * Honest storyboard empty vs error. A failed fetch is not «создать сценарий».
 * No-script is not a chips bar of empty/skeleton placeholders.
 */

export const VIDEO_STORYBOARD_LOAD_ERROR = "Не удалось загрузить сценарии";
export const VIDEO_STORYBOARD_EMPTY_HEADING = "Раскадровки пока нет";
export const VIDEO_STORYBOARD_EMPTY_TITLE = "Создать сценарий раскадровки";
export const VIDEO_STORYBOARD_EMPTY_HINT =
  "Сценарий — это список сцен. В каждой сцене: текст для диктора, сгенерированный кадр и озвучка. Из них плеер соберёт фильм.";
export const VIDEO_STORYBOARD_NO_SCENES = "В сценарии пока нет ни одной сцены";
export const VIDEO_STORYBOARD_NOTHING_TO_WATCH =
  "Пока нечего смотреть — сгенерируйте кадр или озвучку любой сцены";
export const VIDEO_STORYBOARD_CREATED = "Сценарий создан";
export const VIDEO_STORYBOARD_CREATED_HINT =
  "Четыре сцены-заготовки — напишите текст и соберите фильм.";
export const VIDEO_STORYBOARD_CREATE_FAILED = "Не удалось создать сценарий";
export const STORYBOARD_SEED_SCENE_COUNT = 4;

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

/** Ghost chip placeholders are loading/error/empty — never an empty script bar. */
export function storyboardShowsScriptChips(view: StoryboardListView): boolean {
  return view === "ready";
}

export function storyboardSeedSceneTitles(
  count = STORYBOARD_SEED_SCENE_COUNT,
): string[] {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : STORYBOARD_SEED_SCENE_COUNT;
  return Array.from({ length: n }, (_, i) => `Сцена ${i + 1}`);
}
