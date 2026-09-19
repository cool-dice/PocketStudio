/**
 * Honest notebook analysis copy. Empty notes and empty LLM blocks are errors,
 * not a finished «анализ готов».
 */

export const EMPTY_NOTE_ANALYSIS_MESSAGE =
  "Пустая заметка — нечего анализировать";

export const EMPTY_ANALYSIS_BLOCKS_MESSAGE =
  "Анализ завершился, но блоки пусты. Попробуйте переанализировать заметку.";

export const ANALYSIS_FAILED_FALLBACK =
  "Анализ завершился с ошибкой. Попробуйте запустить его ещё раз.";

export function isUsableNoteText(text: string | null | undefined): boolean {
  return (text ?? "").trim().length > 0;
}
