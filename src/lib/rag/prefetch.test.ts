import { describe, expect, test } from "bun:test";

import {
  formatPrefetchBlock,
  formatPrefetchHint,
  looksLikeCanonQuestion,
} from "./prefetch";

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
    expect(block).not.toContain("поиск без эмбеддингов");
  });

  test("keyword prefetch is labeled and does not claim vectors", () => {
    const block = formatPrefetchBlock(
      [
        {
          title: "гл. 2",
          excerpt: "У Марины карие глаза",
          path: "гл. 2",
          workspaceName: "Тишина",
        },
      ],
      { mode: "keyword", notice: "поиск без эмбеддингов" },
    );
    expect(block).toContain("поиск без эмбеддингов");
    expect(block).toContain("карие глаза");
    expect(block).not.toMatch(/вектор/i);
  });

  test("does not dump a giant excerpt into the block", () => {
    const block = formatPrefetchBlock([
      {
        title: "гл. 2",
        excerpt: "карие ".repeat(80),
        path: "гл. 2",
      },
    ]);
    expect(block.length).toBeLessThan(400);
    expect(block).toContain("…");
  });
});

describe("formatPrefetchHint", () => {
  test("labels studio vs workspace canon", () => {
    expect(formatPrefetchHint("studio", 3)).toBe("по канону студии");
    expect(formatPrefetchHint("workspace", 1)).toBe("по канону воркспейса");
    expect(formatPrefetchHint("studio", 0)).toBe("");
  });

  test("keyword mode is labeled on the hint", () => {
    expect(formatPrefetchHint("studio", 2, "keyword")).toBe(
      "по канону студии · поиск без эмбеддингов",
    );
    expect(formatPrefetchHint("workspace", 1, "keyword")).toBe(
      "по канону воркспейса · поиск без эмбеддингов",
    );
    expect(formatPrefetchHint("studio", 2, "vector")).toBe("по канону студии");
  });
});
