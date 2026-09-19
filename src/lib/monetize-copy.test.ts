import { describe, expect, test } from "bun:test";

import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";

import {
  MONETIZE_PLAN_FAILED,
  MONETIZE_PLAN_FAILED_HINT,
  MONETIZE_UNCONFIGURED_HINT,
  MONETIZE_ASSETS_HINT,
  MONETIZE_ASSETS_TITLE,
  monetizeGenerateErrorHint,
} from "./monetize-copy";

describe("monetize plan honesty copy", () => {
  test("unconfigured hint is not a ready-plan or Stripe claim", () => {
    expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
    expect(MONETIZE_UNCONFIGURED_HINT).toMatch(/Модели ИИ/);
    expect(MONETIZE_UNCONFIGURED_HINT).toMatch(/монетизац/i);
    expect(MONETIZE_PLAN_FAILED).not.toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(MONETIZE_PLAN_FAILED_HINT).toMatch(/[А-Яа-яЁё]/);
    expect(MONETIZE_UNCONFIGURED_HINT).not.toMatch(/stripe|карта|выплачено/i);
    expect(MONETIZE_PLAN_FAILED_HINT).not.toMatch(/stripe/i);
  });

  test("generate hint uses UNCONFIGURED copy, not busy-model copy", () => {
    expect(monetizeGenerateErrorHint(UNCONFIGURED_TOOL_MESSAGE)).toBe(
      MONETIZE_UNCONFIGURED_HINT,
    );
    expect(monetizeGenerateErrorHint("таймаут")).toBe(MONETIZE_PLAN_FAILED_HINT);
  });

  test("assets list does not claim a live publish", () => {
    expect(MONETIZE_ASSETS_TITLE).toMatch(/[А-Яа-яЁё]/);
    expect(MONETIZE_ASSETS_HINT).toMatch(/не публикация на хост/i);
    expect(MONETIZE_ASSETS_TITLE).not.toMatch(/публикац/i);
    expect(`${MONETIZE_ASSETS_TITLE}\n${MONETIZE_ASSETS_HINT}`).not.toMatch(
      /publish-ить|опубликовано|stripe/i,
    );
  });
});
