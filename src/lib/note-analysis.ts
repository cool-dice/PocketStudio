/**
 * Honest notebook analysis: unconfigured / failed LLM is an error status,
 * never a fake 4-block JSON. Empty notebook is not a load error.
 */

import { GatewayError } from "./ai/errors";
import { UNCONFIGURED_TOOL_MESSAGE } from "./ai/tools";
import { isCategoryColor, isCategoryIcon } from "./note-utils";

export const EMPTY_NOTE_ANALYSIS_MESSAGE =
  "Пустая заметка — нечего анализировать";

export const EMPTY_ANALYSIS_BLOCKS_MESSAGE =
  "Анализ завершился, но блоки пусты. Попробуйте переанализировать заметку.";

export const ANALYSIS_FAILED_FALLBACK =
  "Анализ завершился с ошибкой. Попробуйте запустить его ещё раз.";

export const ANALYSIS_UNREADABLE_MESSAGE = "LLM вернул нечитаемый ответ";

export const NOTE_ANALYSIS_UNCONFIGURED_HINT =
  "Откройте Админ → Модели ИИ и назначьте модель для анализа заметок.";

export const NOTEBOOK_EMPTY = "Пока пусто";
export const NOTEBOOK_EMPTY_HINT =
  "Запишите первую мысль через ⌘K или попросите агента в чате — всё появится здесь.";
export const NOTEBOOK_FILTER_EMPTY = "Здесь пока пусто";
export const NOTEBOOK_FILTER_EMPTY_HINT =
  "В этом фильтре нет заметок. Попробуйте другой фильтр или запишите новую мысль.";
export const NOTEBOOK_LOAD_ERROR = "Не удалось загрузить заметки";
export const NOTEBOOK_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой блокнот.";

const MAX_BLOCK_CHARS = 4000;
const MAX_RECOMMENDATIONS = 8;
const MAX_RECOMMENDATION_CHARS = 300;
const MAX_CATEGORY_NAME = 40;
const MAX_ERROR_CHARS = 500;

export function isUsableNoteText(text: string | null | undefined): boolean {
  return (text ?? "").trim().length > 0;
}

export function hasUsableAnalysisBlocks(note: {
  positive?: string | null;
  negative?: string | null;
  final?: string | null;
  recommendations?: string[] | null;
}): boolean {
  return (
    !!(note.positive && note.positive.trim()) ||
    !!(note.negative && note.negative.trim()) ||
    !!(note.final && note.final.trim()) ||
    (note.recommendations?.length ?? 0) > 0
  );
}

export type ParsedNoteAnalysis = {
  positive: string;
  negative: string;
  final: string;
  recommendations: string[];
  categoryName: string | null;
  categoryColor: string;
  categoryIcon: string;
};

function stripFences(text: string): string {
  const m = text.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```\s*$/);
  return m ? m[1] : text;
}

/** Parse 4-block JSON. Missing/empty positive|negative|final → null (no invention). */
export function parseNoteAnalysis(raw: string): ParsedNoteAnalysis | null {
  const trimmed = stripFences(raw.trim());
  if (!trimmed) return null;

  const candidates: string[] = [trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first && (first > 0 || last < trimmed.length - 1)) {
    candidates.push(trimmed.slice(first, last + 1));
  }

  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      continue;
    }

    const obj = parsed as Record<string, unknown>;
    const positive = typeof obj.positive === "string" ? obj.positive.trim() : "";
    const negative = typeof obj.negative === "string" ? obj.negative.trim() : "";
    const final = typeof obj.final === "string" ? obj.final.trim() : "";
    if (!positive || !negative || !final) continue;

    const recommendations = Array.isArray(obj.recommendations)
      ? obj.recommendations
          .filter((r): r is string => typeof r === "string" && r.trim().length > 0)
          .map((r) => r.trim().slice(0, MAX_RECOMMENDATION_CHARS))
          .slice(0, MAX_RECOMMENDATIONS)
      : [];
    if (recommendations.length === 0) continue;

    const categoryName =
      typeof obj.category_name === "string" && obj.category_name.trim()
        ? obj.category_name.trim().slice(0, MAX_CATEGORY_NAME)
        : null;
    const categoryColor =
      typeof obj.category_color === "string" && isCategoryColor(obj.category_color)
        ? obj.category_color
        : "stone";
    const categoryIcon =
      typeof obj.category_icon === "string" && isCategoryIcon(obj.category_icon)
        ? obj.category_icon
        : "lightbulb";

    return {
      positive: positive.slice(0, MAX_BLOCK_CHARS),
      negative: negative.slice(0, MAX_BLOCK_CHARS),
      final: final.slice(0, MAX_BLOCK_CHARS),
      recommendations,
      categoryName,
      categoryColor,
      categoryIcon,
    };
  }
  return null;
}

export function isUnconfiguredAnalysisError(err: unknown): boolean {
  return err instanceof Error && err.message === UNCONFIGURED_TOOL_MESSAGE;
}

/** User-facing error for a failed notes run. Unconfigured is never wrapped. */
export function analysisErrorMessage(err: unknown): string {
  if (isUnconfiguredAnalysisError(err)) return UNCONFIGURED_TOOL_MESSAGE;
  if (err instanceof GatewayError && err.message.trim()) {
    return `Анализ не удался: ${err.message}`.slice(0, MAX_ERROR_CHARS);
  }
  if (err instanceof Error && err.message.trim()) {
    return `Анализ не удался: ${err.message}`.slice(0, MAX_ERROR_CHARS);
  }
  return ANALYSIS_FAILED_FALLBACK;
}

/** Prisma update payload: error status, no invented 4-block fields. */
export function failedNoteAnalysisData(errorMessage: string) {
  return {
    status: "error" as const,
    positiveBlock: null,
    negativeBlock: null,
    finalBlock: null,
    recommendations: null,
    analysisRaw: null,
    analyzedAt: null,
    errorMessage: errorMessage.slice(0, MAX_ERROR_CHARS),
    updatedAt: new Date(),
  };
}

export function queuedNoteAnalysisData() {
  return {
    status: "pending" as const,
    positiveBlock: null,
    negativeBlock: null,
    finalBlock: null,
    recommendations: null,
    analysisRaw: null,
    analyzedAt: null,
    errorMessage: null,
    updatedAt: new Date(),
  };
}

/**
 * Create / re-queue payload. Unconfigured `notes` is status=error
 * immediately — do not leave the row pending for the analyzer poll.
 */
export function noteAnalysisFieldsForQueue(unconfigured: boolean) {
  return unconfigured
    ? failedNoteAnalysisData(UNCONFIGURED_TOOL_MESSAGE)
    : queuedNoteAnalysisData();
}

export function processedNoteAnalysisData(analysis: ParsedNoteAnalysis) {
  return {
    status: "processed" as const,
    positiveBlock: analysis.positive,
    negativeBlock: analysis.negative,
    finalBlock: analysis.final,
    recommendations: JSON.stringify(analysis.recommendations),
    analysisRaw: null,
    analyzedAt: new Date(),
    errorMessage: null,
    updatedAt: new Date(),
  };
}
