import { describe, expect, test } from "bun:test";

import {
  PIPELINE_STAGE_INDEX_RANGE,
  PIPELINE_STAGE_MISMATCH,
  PIPELINE_STAGE_SAVE_FAILED,
  PIPELINE_STAGE_SAVED,
  PIPELINE_STAGE_UNKNOWN,
  resolvePipelineStagePatch,
} from "./pipeline-stage";
import { PIPELINE_RELEASE_STAGE, WORKSPACE_STAGES } from "./workspace-data";

describe("pipeline stage PATCH honesty", () => {
  test("skips when neither stage nor index is sent", () => {
    expect(resolvePipelineStagePatch("film", {})).toEqual({
      ok: true,
      skip: true,
    });
  });

  test("name maps to 1-based index; legacy Публикация → Выпуск", () => {
    expect(resolvePipelineStagePatch("film", { stage: "Монтаж" })).toEqual({
      ok: true,
      skip: false,
      stage: "Монтаж",
      stageIndex: 5,
    });
    expect(
      resolvePipelineStagePatch("film", { stage: "Публикация" }),
    ).toEqual({
      ok: true,
      skip: false,
      stage: PIPELINE_RELEASE_STAGE,
      stageIndex: WORKSPACE_STAGES.film.length,
    });
    expect(
      resolvePipelineStagePatch("book", { stage: "  Выпуск  " }),
    ).toEqual({
      ok: true,
      skip: false,
      stage: PIPELINE_RELEASE_STAGE,
      stageIndex: WORKSPACE_STAGES.book.length,
    });
  });

  test("index maps to the type's stage; out of range is an error", () => {
    expect(resolvePipelineStagePatch("music", { stageIndex: 1 })).toEqual({
      ok: true,
      skip: false,
      stage: "Идея",
      stageIndex: 1,
    });
    expect(resolvePipelineStagePatch("music", { stageIndex: 12 })).toEqual({
      ok: false,
      error: PIPELINE_STAGE_INDEX_RANGE,
    });
    expect(resolvePipelineStagePatch("app", { stageIndex: 0 })).toEqual({
      ok: false,
      error: PIPELINE_STAGE_INDEX_RANGE,
    });
  });

  test("unknown or foreign stage is rejected, not stored", () => {
    expect(resolvePipelineStagePatch("film", { stage: "Прод" })).toEqual({
      ok: false,
      error: PIPELINE_STAGE_UNKNOWN,
    });
    expect(resolvePipelineStagePatch("film", { stage: "Код" })).toEqual({
      ok: false,
      error: PIPELINE_STAGE_UNKNOWN,
    });
    expect(resolvePipelineStagePatch("film", { stage: "" })).toEqual({
      ok: false,
      error: PIPELINE_STAGE_UNKNOWN,
    });
    expect(PIPELINE_STAGE_UNKNOWN).toMatch(/[А-Яа-яЁё]/);
    expect(PIPELINE_STAGE_SAVED).toMatch(/[А-Яа-яЁё]/);
    expect(PIPELINE_STAGE_SAVE_FAILED).toMatch(/не удалось/i);
    expect(PIPELINE_STAGE_SAVED).not.toMatch(/не удалось/i);
  });

  test("stage and index must agree when both are sent", () => {
    expect(
      resolvePipelineStagePatch("film", { stage: "Сценарий", stageIndex: 1 }),
    ).toEqual({
      ok: true,
      skip: false,
      stage: "Сценарий",
      stageIndex: 1,
    });
    expect(
      resolvePipelineStagePatch("film", { stage: "Сценарий", stageIndex: 3 }),
    ).toEqual({ ok: false, error: PIPELINE_STAGE_MISMATCH });
  });
});
