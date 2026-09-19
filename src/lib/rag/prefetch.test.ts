import { describe, expect, test } from "bun:test";

import { formatPrefetchBlock, looksLikeCanonQuestion } from "./prefetch";

describe("looksLikeCanonQuestion", () => {
  test("skips trivial chitchat and tiny messages", () => {
    expect(looksLikeCanonQuestion("привет")).toBe(false);
    expect(looksLikeCanonQuestion("ok")).toBe(false);
    expect(looksLikeCanonQuestion("спасибо!")).toBe(false);
    expect(looksLikeCanonQuestion("hi")).toBe(false);
    expect(looksLikeCanonQuestion("да")).toBe(false);
  });

  test("runs for content/code questions", () => {
    expect(looksLikeCanonQuestion("Какого цвета глаза у Марины?")).toBe(true);
    expect(looksLikeCanonQuestion("Где в коде функция agent?")).toBe(true);
    expect(looksLikeCanonQuestion("что в главе 2 про маяк")).toBe(true);
    expect(
      looksLikeCanonQuestion(
        "Нужно понять, как устроен retrieve в приложении coder и какие пути файлов там есть",
      ),
    ).toBe(true);
  });
});

describe("formatPrefetchBlock", () => {
  test("empty hits stay empty so chitchat is not blocked", () => {
    expect(formatPrefetchBlock([])).toBe("");
  });

  test("injects snippets with workspace and path", () => {
    const block = formatPrefetchBlock([
      {
        title: "гл. 2",
        excerpt: "У Марины карие глаза",
        path: "гл. 2",
        workspaceName: "Тишина",
      },
    ]);
    expect(block).toContain("Автоконтекст RAG");
    expect(block).toContain("Тишина");
    expect(block).toContain("карие глаза");
  });
});
