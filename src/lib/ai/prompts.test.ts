import { describe, expect, test } from "bun:test";

import {
  DOCUMENT_ANALYST_SYSTEM,
  IDENTITY_BLOCK,
  JSON_TOOL_CONTRACT,
  NOTES_ANALYSIS_SYSTEM,
  sectionSystemFor,
  wrapSkillDocs,
} from "./prompts";
import { buildAgentSystemPrompt, buildPlannerPrompt } from "../../mini-services/agent-service/prompts";

describe("prompt library", () => {
  test("identity is PocketStudio штурман, not a vendor chatbot", () => {
    expect(IDENTITY_BLOCK).toContain("штурман студии PocketStudio");
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
  });

  test("skill wrapper does not duplicate identity", () => {
    const wrapped = wrapSkillDocs(["---\nname: Test\n---\nШаг 1"]);
    expect(wrapped).toContain("не новая личность");
    expect(wrapped).toContain("Шаг 1");
  });
});

describe("agent system prompt builder", () => {
  test("ask mode forbids file mutation tools", () => {
    const prompt = buildAgentSystemPrompt({ mode: "ask" });
    expect(prompt).toContain("штурман студии PocketStudio");
    expect(prompt).toContain("retrieve_canon");
    expect(prompt).toContain("apply_patch");
    expect(prompt).toContain("Запрещено: write_file");
    expect(prompt).not.toMatch(/ChatGLM|z-ai|VibeFlow/i);
  });

  test("act mode prefers patch and scopes to project tree", () => {
    const prompt = buildAgentSystemPrompt({
      mode: "act",
      projectName: "Клип",
      projectTree: ["app/page.tsx", "README.md"],
    });
    expect(prompt).toContain("apply_patch");
    expect(prompt).toContain("Клип");
    expect(prompt).toContain("app/page.tsx");
    expect(prompt).toContain("Пиши только в эти пути");
  });

  test("planner refuses invented work and stays in project", () => {
    const prompt = buildPlannerPrompt({
      hasProject: true,
      projectName: "App",
      projectTree: ["src/index.ts"],
    });
    expect(prompt).toContain("не выдумывай работу");
    expect(prompt).toContain("src/index.ts");
    expect(prompt).toContain('"steps"');
  });

  test("skills inject once via wrapper", () => {
    const prompt = buildAgentSystemPrompt({
      mode: "ask",
      skillDocs: ["---\nname: Копирайтер\n---\nПиши главы"],
    });
    expect(prompt).toContain("Копирайтер");
    expect(prompt).toContain("не новая личность");
  });
});
