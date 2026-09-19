import { describe, expect, test } from "bun:test";

import {
  ANALYSIS_FAILED_FALLBACK,
  EMPTY_ANALYSIS_BLOCKS_MESSAGE,
  EMPTY_NOTE_ANALYSIS_MESSAGE,
  isUsableNoteText,
} from "./note-analysis";

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
    ].join("\n");
    expect(blob).toMatch(/[А-Яа-яЁё]/);
    expect(blob).not.toMatch(/анализ готов|успешно проанализир/i);
  });
});
