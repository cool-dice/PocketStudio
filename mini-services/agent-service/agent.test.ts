import { describe, expect, test } from "bun:test";

import { parsePlannerSteps, parseToolCall } from "./agent";
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

  test("accepts stringified arguments", () => {
    const call = parseToolCall(
      '{"tool":"retrieve_canon","arguments":"{\\"query\\":\\"глаза\\"}"}',
    );
    expect(call?.tool).toBe("retrieve_canon");
    expect(call?.args.query).toBe("глаза");
  });

  test("returns null for a plain answer", () => {
    expect(parseToolCall("Готово: глава лежит в документах.")).toBeNull();
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
      "retrieve_canon",
      "retrieve_code",
      "apply_patch",
      "tag_note",
      "set_reminder",
      "rewrite_section",
      "fetch_url",
      "web_search",
      "browser_read",
    ]) {
      expect(names).toContain(name);
    }
  });
});
