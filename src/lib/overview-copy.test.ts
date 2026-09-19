import { describe, expect, test } from "bun:test";

import { WORKSPACE_STAGES, type WorkspaceType } from "./workspace-data";
import {
  NEXT_STEP_PROMPTS,
  OVERVIEW_NEXT_FALLBACK,
  nextStepOf,
  overviewAskDraft,
  overviewNextStepBlob,
} from "./overview-copy";

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
});
