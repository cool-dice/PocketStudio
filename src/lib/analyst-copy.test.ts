import { describe, expect, test } from "bun:test";

import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";

import {
  ANALYST_CHECK_FAILED,
  ANALYST_CHECK_FAILED_HINT,
  ANALYST_CHECK_UNCONFIGURED_HINT,
  ANALYST_EMPTY_OK,
  ANALYST_EMPTY_OK_HINT,
  ANALYST_LOAD_ERROR,
  ANALYST_LOAD_ERROR_HINT,
  ANALYST_NEVER_RAN,
  ANALYST_NEVER_RAN_HINT,
} from "./analyst-copy";

describe("analyst honesty copy", () => {
  test("failed check does not read as accepted issues or all-clear", () => {
    expect(ANALYST_CHECK_FAILED).toMatch(/[А-Яа-яЁё]/);
    expect(ANALYST_CHECK_FAILED_HINT).toMatch(/не отчёт о проблемах/i);
    expect(ANALYST_CHECK_FAILED_HINT).not.toMatch(/исправлено|принято|готово/i);
    expect(ANALYST_LOAD_ERROR).not.toBe(ANALYST_EMPTY_OK);
    expect(ANALYST_LOAD_ERROR_HINT).toMatch(/не отчёт/i);
    expect(ANALYST_NEVER_RAN).not.toBe(ANALYST_EMPTY_OK);
    expect(ANALYST_NEVER_RAN_HINT).toMatch(/успешной проверки/i);
  });

  test("empty successful run is distinct from never-ran and from error", () => {
    expect(ANALYST_EMPTY_OK).toMatch(/противоречий нет/i);
    expect(ANALYST_EMPTY_OK_HINT).toMatch(/пустой список/i);
    expect(ANALYST_EMPTY_OK).not.toBe(ANALYST_CHECK_FAILED);
    expect(ANALYST_EMPTY_OK).not.toBe(ANALYST_NEVER_RAN);
  });

  test("unconfigured copy points at Admin → models", () => {
    expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
    expect(ANALYST_CHECK_UNCONFIGURED_HINT).toMatch(/Модели ИИ/);
    expect(ANALYST_CHECK_UNCONFIGURED_HINT).toMatch(/Проверка документа/);
  });
});
