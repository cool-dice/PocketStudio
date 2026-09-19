import { describe, expect, test } from "bun:test";

import { GatewayError } from "./ai/errors";
import { UNCONFIGURED_TOOL_MESSAGE } from "./ai/tools";
import {
  ANALYSIS_FAILED_FALLBACK,
  ANALYSIS_UNREADABLE_MESSAGE,
  EMPTY_ANALYSIS_BLOCKS_MESSAGE,
  EMPTY_NOTE_ANALYSIS_MESSAGE,
  NOTEBOOK_EMPTY,
  NOTEBOOK_EMPTY_HINT,
  NOTEBOOK_FILTER_EMPTY,
  NOTEBOOK_LOAD_ERROR,
  NOTEBOOK_LOAD_ERROR_HINT,
  NOTE_ANALYSIS_UNCONFIGURED_HINT,
  analysisErrorMessage,
  failedNoteAnalysisData,
  hasUsableAnalysisBlocks,
  isUnconfiguredAnalysisError,
  isUsableNoteText,
  parseNoteAnalysis,
  processedNoteAnalysisData,
} from "./note-analysis";

const completeJson = JSON.stringify({
  positive: "Маяк даёт сильный образ.",
  negative: "Риск — слишком общая сцена.",
  final: "Сжать до одной ночи у маяка.",
  recommendations: ["Написать первый кадр", "Убрать лишние герои"],
  category_name: "Идеи",
  category_color: "emerald",
  category_icon: "lightbulb",
});

describe("note analysis honesty", () => {
  test("empty text is not analyzable", () => {
    expect(isUsableNoteText("")).toBe(false);
    expect(isUsableNoteText("  \n")).toBe(false);
    expect(isUsableNoteText(null)).toBe(false);
    expect(isUsableNoteText("маяк")).toBe(true);
  });

  test("empty/error copy is Russian and does not claim analysis is ready", () => {
    const blob = [
      EMPTY_NOTE_ANALYSIS_MESSAGE,
      EMPTY_ANALYSIS_BLOCKS_MESSAGE,
      ANALYSIS_FAILED_FALLBACK,
      ANALYSIS_UNREADABLE_MESSAGE,
    ].join("\n");
    expect(blob).toMatch(/[А-Яа-яЁё]/);
    expect(blob).not.toMatch(/анализ готов|успешно проанализир/i);
  });

  test("notebook load error is not the empty-notebook message", () => {
    expect(NOTEBOOK_LOAD_ERROR).not.toBe(NOTEBOOK_EMPTY);
    expect(NOTEBOOK_LOAD_ERROR).not.toMatch(/пока пусто/i);
    expect(NOTEBOOK_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(NOTEBOOK_FILTER_EMPTY).not.toBe(NOTEBOOK_LOAD_ERROR);
    expect(NOTEBOOK_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(NOTEBOOK_EMPTY_HINT).toMatch(/⌘K|агента/i);
  });

  test("unconfigured copy is UNCONFIGURED_TOOL_MESSAGE, not a 4-block claim", () => {
    expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
    expect(NOTE_ANALYSIS_UNCONFIGURED_HINT).toMatch(/Модели ИИ/);
    expect(NOTE_ANALYSIS_UNCONFIGURED_HINT).toMatch(/анализ/i);
    expect(ANALYSIS_FAILED_FALLBACK).not.toBe(UNCONFIGURED_TOOL_MESSAGE);
  });

  test("parseNoteAnalysis requires all three blocks and recommendations", () => {
    expect(parseNoteAnalysis(completeJson)?.positive).toMatch(/маяк/i);
    expect(parseNoteAnalysis(completeJson)?.recommendations).toHaveLength(2);
    expect(parseNoteAnalysis("{}")).toBeNull();
    expect(parseNoteAnalysis("not json")).toBeNull();
    expect(
      parseNoteAnalysis(
        JSON.stringify({
          positive: "ok",
          negative: "",
          final: "ok",
          recommendations: ["a"],
        }),
      ),
    ).toBeNull();
    expect(
      parseNoteAnalysis(
        JSON.stringify({
          positive: "ok",
          negative: "ok",
          final: "ok",
          recommendations: [],
        }),
      ),
    ).toBeNull();
  });

  test("failed analysis data clears positive/negative/final", () => {
    const data = failedNoteAnalysisData(UNCONFIGURED_TOOL_MESSAGE);
    expect(data.status).toBe("error");
    expect(data.errorMessage).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(data.positiveBlock).toBeNull();
    expect(data.negativeBlock).toBeNull();
    expect(data.finalBlock).toBeNull();
    expect(data.recommendations).toBeNull();
    expect(data.analyzedAt).toBeNull();
  });

  test("processed analysis data persists the four blocks", () => {
    const parsed = parseNoteAnalysis(completeJson);
    expect(parsed).toBeTruthy();
    const data = processedNoteAnalysisData(parsed!);
    expect(data.status).toBe("processed");
    expect(data.positiveBlock).toBe(parsed!.positive);
    expect(data.negativeBlock).toBe(parsed!.negative);
    expect(data.finalBlock).toBe(parsed!.final);
    expect(JSON.parse(data.recommendations as string)).toEqual(parsed!.recommendations);
    expect(data.errorMessage).toBeNull();
    expect(data.analyzedAt).toBeInstanceOf(Date);
  });

  test("unconfigured error is not wrapped and is not invented blocks", () => {
    const err = new GatewayError(UNCONFIGURED_TOOL_MESSAGE, 400);
    expect(isUnconfiguredAnalysisError(err)).toBe(true);
    expect(analysisErrorMessage(err)).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(analysisErrorMessage(err)).not.toMatch(/^Анализ не удался:/);
    expect(hasUsableAnalysisBlocks({ positive: null, negative: null, final: null })).toBe(
      false,
    );
  });
});
