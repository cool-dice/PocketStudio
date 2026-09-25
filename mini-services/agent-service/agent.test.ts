import { describe, expect, test } from "bun:test";

import { parsePlannerSteps, parseToolCall, parseToolCallResult, looksLikeToolStart } from "./agent";
import {
  TOOL_ARGS_LIMIT,
  TOOL_ARGS_LIMIT_LARGE,
  TOOL_ARGS_TOO_LARGE,
} from "./tool-args-limit";
import { TOOLS } from "./tools";

describe("parseToolCall", () => {
  test("reads a bare JSON tool object", () => {
    const call = parseToolCall(
      '{"tool":"create_note","args":{"text":"маяк"}}',
    );
    expect(call).toEqual({ tool: "create_note", args: { text: "маяк" } });
  });

  test("strips markdown fences", () => {
    const call = parseToolCall(
      '```json\n{"tool":"retrieve_canon","args":{"query":"глаза"}}\n```',
    );
    expect(call?.tool).toBe("retrieve_canon");
    expect(call?.args.query).toBe("глаза");
  });

  test("takes the first object when two are chained", () => {
    const call = parseToolCall(
      '{"tool":"list_files","args":{"path":"."}}{"tool":"read_file","args":{"path":"a.ts"}}',
    );
    expect(call?.tool).toBe("list_files");
  });

  test("extracts JSON after a short prose prefix", () => {
    const call = parseToolCall(
      'Сейчас запишу.\n{"tool":"create_note","args":{"text":"клип"}}',
    );
    expect(call?.tool).toBe("create_note");
  });

  test("extracts a fenced JSON tool call after stray prose", () => {
    const call = parseToolCall(
      'Сначала найду канон.\n```json\n{"tool":"retrieve_canon","args":{"query":"глаза"}}\n```\nГотово.',
    );
    expect(call?.tool).toBe("retrieve_canon");
    expect(call?.args.query).toBe("глаза");
  });

  test("accepts trailing commas in tool JSON", () => {
    const call = parseToolCall(
      '{"tool":"retrieve_code","args":{"query":"agent",},}',
    );
    expect(call?.tool).toBe("retrieve_code");
    expect(call?.args.query).toBe("agent");
  });

  test("accepts OpenAI-style name/arguments", () => {
    const call = parseToolCall(
      '{"name":"retrieve_canon","arguments":{"query":"Марина"}}',
    );
    expect(call?.tool).toBe("retrieve_canon");
    expect(call?.args.query).toBe("Марина");
  });

  test("accepts nested function.name / arguments", () => {
    const call = parseToolCall(
      '{"function":{"name":"retrieve_canon","arguments":{"query":"глаза"}}}',
    );
    expect(call?.tool).toBe("retrieve_canon");
    expect(call?.args.query).toBe("глаза");
  });

  test("accepts stringified arguments", () => {
    const call = parseToolCall(
      '{"tool":"retrieve_canon","arguments":"{\\"query\\":\\"глаза\\"}"}',
    );
    expect(call?.tool).toBe("retrieve_canon");
    expect(call?.args.query).toBe("глаза");
  });

  test("returns null for a partial tool JSON object", () => {
    expect(parseToolCall('{"tool":"create_note","args":{"te')).toBeNull();
    expect(parseToolCall('{"tool":"create_note"')).toBeNull();
  });

  test("returns null for a plain answer", () => {
    expect(parseToolCall("Готово: глава лежит в документах.")).toBeNull();
  });

  test("rejects a 256 KiB+ create_note dump (no execute payload)", () => {
    const started = Date.now();
    const raw = JSON.stringify({
      tool: "create_note",
      args: { text: "x".repeat(TOOL_ARGS_LIMIT + 8) },
    });
    expect(parseToolCall(raw)).toBeNull();
    const parsed = parseToolCallResult(raw);
    expect(parsed.status).toBe("oversized");
    if (parsed.status !== "oversized") throw new Error("expected oversized");
    expect(parsed.tool).toBe("create_note");
    expect(parsed.error).toContain(TOOL_ARGS_TOO_LARGE);
    expect(parsed.error).toContain("256 КБ");
    expect(parsed.error).toMatch(/[А-Яа-яЁё]/);
    expect(Date.now() - started).toBeLessThan(500);
  });

  test("write_file may carry more than 256 KiB but not more than 1 MiB", () => {
    const mid = JSON.stringify({
      tool: "write_file",
      args: { path: "a.ts", content: "x".repeat(TOOL_ARGS_LIMIT + 8) },
    });
    expect(parseToolCall(mid)?.tool).toBe("write_file");
    expect(parseToolCallResult(mid).status).toBe("call");

    const started = Date.now();
    const huge = JSON.stringify({
      tool: "apply_patch",
      args: { path: "a.ts", newText: "x".repeat(TOOL_ARGS_LIMIT_LARGE + 8) },
    });
    expect(parseToolCall(huge)).toBeNull();
    const parsed = parseToolCallResult(huge);
    expect(parsed.status).toBe("oversized");
    if (parsed.status !== "oversized") throw new Error("expected oversized");
    expect(parsed.tool).toBe("apply_patch");
    expect(parsed.error).toContain("1 МБ");
    expect(Date.now() - started).toBeLessThan(500);
  });

  test("oversized fenced create_note is not a text answer", () => {
    const raw = `\`\`\`json\n${JSON.stringify({
      tool: "create_note",
      args: { text: "x".repeat(TOOL_ARGS_LIMIT + 8) },
    })}\n\`\`\``;
    const parsed = parseToolCallResult(raw);
    expect(parsed.status).toBe("oversized");
    expect(parseToolCall(raw)).toBeNull();
  });
});

describe("looksLikeToolStart", () => {
  test("detects JSON, fences, and the legacy bracket form", () => {
    expect(looksLikeToolStart('{"tool":')).toBe(true);
    expect(looksLikeToolStart('  ```json\n{"tool"')).toBe(true);
    expect(looksLikeToolStart("[TOOL_CALL create_note] {}")).toBe(true);
    expect(looksLikeToolStart("Привет, вот план")).toBe(false);
  });
});

describe("parsePlannerSteps", () => {
  test("reads a steps array", () => {
    const steps = parsePlannerSteps(
      '{"steps":["Создать проект Клип","Написать index.html","Чекпоинт"]}',
    );
    expect(steps).toEqual([
      "Создать проект Клип",
      "Написать index.html",
      "Чекпоинт",
    ]);
  });
});

describe("agent tool registry", () => {
  test("includes prototype ports", () => {
    const names = TOOLS.map((t) => t.name);
    for (const name of [
      "create_workspace",
      "list_workspaces",
      "create_note",
      "retrieve_code",
      "apply_patch",
      "tag_note",
      "set_reminder",
      "rewrite_section",
      "fetch_url",
      "web_search",
      "browser_read",
      "deploy_project",
    ]) {
      expect(names).toContain(name);
    }
  });
});
