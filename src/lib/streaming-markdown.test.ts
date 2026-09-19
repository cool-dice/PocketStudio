import { describe, expect, test } from "bun:test";

import { stabilizeStreamingMarkdown } from "./streaming-markdown";

describe("stabilizeStreamingMarkdown", () => {
  test("closes an unclosed bold token so the renderer does not flicker", () => {
    expect(stabilizeStreamingMarkdown("Это **жирн")).toBe("Это **жирн**");
  });

  test("closes an unclosed fence", () => {
    const out = stabilizeStreamingMarkdown("код:\n```ts\nconst x = 1;");
    expect(out.endsWith("```")).toBe(true);
    expect(out.startsWith("код:")).toBe(true);
  });

  test("leaves already-balanced markdown alone", () => {
    expect(stabilizeStreamingMarkdown("**готово** и `ok`")).toBe(
      "**готово** и `ok`",
    );
  });
});
