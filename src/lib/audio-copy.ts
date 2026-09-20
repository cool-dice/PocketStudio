/**
 * Honest audio / TTS copy. Load failure is not an empty library;
 * failed TTS is not a playable track.
 */

export const DAW_EMPTY_TRACKS = "Дорожек пока нет";
export const DAW_EMPTY_TRACKS_HINT =
  "Добавьте барабаны, бас или пэд — и соберите карманный трек. Это не ошибка загрузки.";
export const DAW_LOAD_ERROR = "Не удалось загрузить проект студии";

export const AUDIO_LIBRARY_EMPTY = "Аудио пока нет";
export const AUDIO_LIBRARY_EMPTY_HINT =
  "Озвучьте текст во вкладке «Озвучка» или соберите трек в «Студии» — готовые записи и миксы появятся здесь.";
export const AUDIO_LIBRARY_LOAD_ERROR = "Не удалось загрузить аудиотеку";
export const AUDIO_LIBRARY_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустая аудиотека.";

export const NARRATION_LIBRARY_EMPTY = "Озвучек пока нет";
export const NARRATION_LIBRARY_EMPTY_HINT =
  "Напишите текст выше и нажмите «Озвучить» — трек появится здесь.";
export const NARRATION_LIBRARY_LOAD_ERROR = "Не удалось загрузить библиотеку озвучек";
export const NARRATION_LIBRARY_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой список озвучек.";

export const AUDIO_TTS_FAILED = "Озвучка не удалась";
export const AUDIO_TTS_FAILED_HINT =
  "Трек не сохранён и не воспроизводится. Попробуйте ещё раз.";
export const AUDIO_TTS_UNCONFIGURED_HINT =
  "Откройте Админ → Модели ИИ и назначьте модель для озвучки.";

export const VOICE_TRACK_EMPTY = "Нет аудио в воркспейсе";
export const VOICE_TRACK_LOAD_ERROR = "Не удалось загрузить аудио воркспейса";
export const VOICE_TRACK_LOAD_ERROR_HINT =
  "Список не пустой — обновите, чтобы выбрать озвучку.";

export type TtsPlaybackState = "idle" | "busy" | "ready";

/**
 * After a TTS attempt the UI must leave "busy". Failure never stays
 * "ready" (a playing ghost with no file).
 */
export function ttsPlaybackAfterAttempt(ok: boolean): Exclude<TtsPlaybackState, "busy"> {
  return ok ? "ready" : "idle";
}

/** Only a live URL is a player src — missing blobs are not playable. */
export function playableAudioSrc(
  item: { url?: string | null; fileMissing?: boolean } | null | undefined,
): string | null {
  if (!item?.url || item.fileMissing) return null;
  return item.url;
}
