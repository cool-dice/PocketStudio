import { describe, expect, test } from "bun:test";

import {
  PIPELINE_RELEASE_STAGE,
  WORKSPACE_STAGES,
  WORKSPACE_TYPE_META,
  canonicalStageLabel,
  pipelineStageIndex,
  type WorkspaceType,
} from "./workspace-data";
import {
  NEXT_STEP_PROMPTS,
  OVERVIEW_NEXT_FALLBACK,
  nextStepOf,
  overviewAskDraft,
  overviewNextStepBlob,
} from "./overview-copy";
import { STAGE_WORK_TABS } from "@/components/workspaces/overview-data";

const SEED_LIES =
  /Маркел|трека «Прилив»|глава 9 «Шторм»|Эйнар|голос «Ника»|сцена 12|4K|v0\.3\.1|выкатывать на хост|опубликовано|успешно записано|Tongtong|z-ai|VibeFlow|Stripe|запрос отправлен/i;

describe("overview next-step honesty", () => {
  test("every pipeline stage has generic Russian copy", () => {
    for (const type of Object.keys(WORKSPACE_STAGES) as WorkspaceType[]) {
      for (const stage of WORKSPACE_STAGES[type]) {
        const prompt = NEXT_STEP_PROMPTS[type][stage];
        expect(prompt).toBeDefined();
        expect(prompt.title).toMatch(/[А-Яа-яЁё]/);
        expect(prompt.hint).toMatch(/[А-Яа-яЁё]/);
        expect(nextStepOf({ type, stage })).toEqual(prompt);
      }
    }
  });

  test("copy is not seed-story, 4K, host, or fake success", () => {
    expect(overviewNextStepBlob()).not.toMatch(SEED_LIES);
    expect(OVERVIEW_NEXT_FALLBACK.hint).toMatch(/чат/i);
  });

  test("unknown stage is fallback, not a seed line", () => {
    expect(nextStepOf({ type: "film", stage: null })).toEqual(OVERVIEW_NEXT_FALLBACK);
    expect(nextStepOf({ type: "book" })).toEqual(OVERVIEW_NEXT_FALLBACK);
    expect(nextStepOf({ type: "app", stage: "Прод" }).title).not.toMatch(
      /задеплоить|выкатывать/i,
    );
  });

  test("ask draft is a question, not a sent-toast", () => {
    const prompt = nextStepOf({ type: "film", stage: "Монтаж" });
    const draft = overviewAskDraft("Мой фильм", "Монтаж", prompt);
    expect(draft).toContain("Мой фильм");
    expect(draft).toContain("Монтаж");
    expect(draft).toContain(prompt.title);
    expect(draft).toMatch(/что предложишь/i);
    expect(draft).not.toMatch(/отправлен|успешно|опубликовано/i);
  });

  test("last pipeline stage is Выпуск, not hosted publish", () => {
    for (const type of ["film", "book", "universal"] as const) {
      const last = WORKSPACE_STAGES[type].at(-1);
      expect(last).toBe(PIPELINE_RELEASE_STAGE);
      expect(last).not.toMatch(/публикац/i);
    }
    const labels = Object.values(WORKSPACE_STAGES).flat().join("\n");
    expect(labels).not.toMatch(/публикац/i);
    expect(WORKSPACE_TYPE_META.film.hint).not.toMatch(/публикац/i);
    expect(WORKSPACE_TYPE_META.book.hint).not.toMatch(/публикац/i);
    expect(WORKSPACE_TYPE_META.film.hint).toMatch(/выпуск/i);
    expect(WORKSPACE_TYPE_META.book.hint).toMatch(/выпуск/i);
  });

  test("legacy DB label Публикация maps to Выпуск copy and index", () => {
    const current = nextStepOf({ type: "film", stage: PIPELINE_RELEASE_STAGE });
    expect(nextStepOf({ type: "film", stage: "Публикация" })).toEqual(current);
    expect(nextStepOf({ type: "book", stage: "Публикация" })).toEqual(
      nextStepOf({ type: "book", stage: PIPELINE_RELEASE_STAGE }),
    );
    expect(nextStepOf({ type: "universal", stage: "Публикация" })).toEqual(
      nextStepOf({ type: "universal", stage: PIPELINE_RELEASE_STAGE }),
    );
    expect(canonicalStageLabel("Публикация")).toBe(PIPELINE_RELEASE_STAGE);
    expect(canonicalStageLabel("Монтаж")).toBe("Монтаж");
    expect(pipelineStageIndex(WORKSPACE_STAGES.film, "Публикация")).toBe(
      WORKSPACE_STAGES.film.length - 1,
    );
    expect(STAGE_WORK_TABS.film[PIPELINE_RELEASE_STAGE]).toBe("monetize");
    expect(STAGE_WORK_TABS.film["Публикация"]).toBeUndefined();
  });
});
