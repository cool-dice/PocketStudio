import { describe, expect, test } from "bun:test";

import { buildAgentSystemPrompt, buildPlannerPrompt } from "./prompts";

describe("agent system prompt builder", () => {
  test("ask mode forbids file mutation tools", () => {
    const prompt = buildAgentSystemPrompt({ mode: "ask" });
    expect(prompt).toContain("штурман студии PocketStudio");
    expect(prompt).toContain("retrieve_canon");
    expect(prompt).toContain("retrieve_code");
    expect(prompt).toContain("ВСЕХ воркспейсов");
    expect(prompt).toContain("apply_patch");
    expect(prompt).toContain("Запрещено: write_file");
    expect(prompt).toContain("fetch_url");
    expect(prompt).toContain("web_search");
    expect(prompt).toContain("browser_read");
    expect(prompt).toContain("deploy_project");
    expect(prompt).toContain("create_workspace");
    expect(prompt).toContain("list_workspaces");
    expect(prompt).not.toContain("create_project — ТОЛЬКО код Next.js");
    expect(prompt).toContain("текст трека/куплет/лирика → create_note");
    expect(prompt).toContain("студии разработки в продукте нет");
    expect(prompt).toContain("напиши песню");
    expect(prompt).not.toContain("шаблоны и студии вместе");
  });

  test("act mode prefers patch and scopes to project tree", () => {
    const prompt = buildAgentSystemPrompt({
      mode: "act",
      projectName: "Клип",
      projectType: "app",
      projectTree: ["app/page.tsx", "README.md"],
    });
    expect(prompt).toContain("apply_patch");
    expect(prompt).toContain("Клип");
    expect(prompt).toContain("app/page.tsx");
    expect(prompt).toContain("Пиши только в эти пути");
    expect(prompt).not.toContain("личный кодер");
    expect(prompt).not.toContain("Тип: приложение");
    expect(prompt).toContain("только ЭТОТ воркспейс");
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
