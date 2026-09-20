import { describe, expect, test } from "bun:test";

import {
  DOCUMENT_ANALYST_SYSTEM,
  IDENTITY_BLOCK,
  JSON_TOOL_CONTRACT,
  NOTES_ANALYSIS_SYSTEM,
  RAG_GLOBAL_BLOCK,
  RAG_WORKSPACE_BLOCK,
  composeImagePrompt,
  IMAGE_PROMPT_PREFIX,
  sectionSystemFor,
  sectionAiAction,
  wrapSkillDocs,
} from "./prompts";

describe("prompt library", () => {
  test("identity is PocketStudio штурман, not a vendor chatbot", () => {
    expect(IDENTITY_BLOCK).toContain("штурман студии PocketStudio");
    expect(IDENTITY_BLOCK).toContain("retrieve_canon");
    expect(IDENTITY_BLOCK.toLowerCase()).not.toContain("z-ai");
    expect(IDENTITY_BLOCK.toLowerCase()).not.toContain("chatglm");
    expect(IDENTITY_BLOCK.toLowerCase()).not.toContain("vibeflow");
  });

  test("tool contract is one JSON object with English keys", () => {
    expect(JSON_TOOL_CONTRACT).toContain('{"tool":"<имя>","args":{...}}');
    expect(JSON_TOOL_CONTRACT).toContain("ровно один");
    expect(JSON_TOOL_CONTRACT).toContain("create_note");
  });

  test("notes analysis keeps proto1 4-block JSON", () => {
    for (const key of ["positive", "negative", "final", "recommendations"]) {
      expect(NOTES_ANALYSIS_SYSTEM).toContain(key);
    }
  });

  test("document analyst forbids invented quotes", () => {
    expect(DOCUMENT_ANALYST_SYSTEM).toContain("дословная цитата");
    expect(DOCUMENT_ANALYST_SYSTEM).toContain("[]");
  });

  test("empty chapter uses write system", () => {
    expect(sectionSystemFor("rewrite", true)).toContain("черновик");
    expect(sectionSystemFor("rewrite", false)).toContain("Перепиши");
    expect(sectionSystemFor("write", false)).toContain("черновик");
    expect(sectionAiAction("")).toBe("write");
    expect(sectionAiAction("   ")).toBe("write");
    expect(sectionAiAction("уже есть текст")).toBe("rewrite");
  });

  test("skill wrapper does not duplicate identity", () => {
    const wrapped = wrapSkillDocs(["---\nname: Test\n---\nШаг 1"]);
    expect(wrapped).toContain("не новая личность");
    expect(wrapped).toContain("Шаг 1");
  });

  test("image prefix is studio-neutral and not duplicated", () => {
    expect(IMAGE_PROMPT_PREFIX.toLowerCase()).not.toContain("z-ai");
    const once = composeImagePrompt("a red boat");
    expect(once.startsWith(IMAGE_PROMPT_PREFIX)).toBe(true);
    expect(once).toContain("a red boat");
    expect(composeImagePrompt(once)).toBe(once);
  });

  test("RAG scope blocks isolate workspace vs studio", () => {
    expect(RAG_GLOBAL_BLOCK).toContain("ВСЕХ воркспейсов");
    expect(RAG_GLOBAL_BLOCK).toContain("Цитируй имя воркспейса");
    expect(RAG_GLOBAL_BLOCK).toContain("только если в этом треде открыт проект");
    expect(RAG_WORKSPACE_BLOCK).toContain("только ЭТОТ воркспейс");
    expect(RAG_WORKSPACE_BLOCK).toContain("личный кодер");
    expect(RAG_WORKSPACE_BLOCK).toContain("открыть её или спросить в главном чате");
    expect(IDENTITY_BLOCK).toContain("не выдумывай");
    expect(IDENTITY_BLOCK).toContain("create_workspace");
    expect(IDENTITY_BLOCK).toContain("create_project — ТОЛЬКО код Next.js");
    expect(RAG_WORKSPACE_BLOCK).toContain("Текст трека");
  });
});
