import { describe, expect, test } from "bun:test";

import { chunkCode, chunkText, estimateTokens } from "./chunk";
import { shouldSkipFileBytes, shouldSkipPath, MAX_INDEX_FILE_BYTES } from "./skip";

describe("chunkText", () => {
  test("splits a long markdown doc into overlapping pieces", () => {
    const paras = Array.from({ length: 40 }, (_, i) => `Абзац номер ${i} про карие глаза Марины.`.repeat(8));
    const chunks = chunkText(paras.join("\n\n"));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]!.ordinal).toBe(0);
    expect(chunks.every((c) => c.tokenCount > 0)).toBe(true);
  });

  test("empty input yields no chunks", () => {
    expect(chunkText("   ")).toEqual([]);
  });
});

describe("chunkCode", () => {
  test("splits TypeScript on function boundaries when cheap", () => {
    const src = `export function alpha() {\n  return 1;\n}\n\nexport function beta() {\n  return 2;\n}\n`;
    const chunks = chunkCode(src, "src/lib/agent.ts");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.some((c) => c.content.includes("alpha"))).toBe(true);
  });
});

describe("estimateTokens", () => {
  test("cyrillic is denser than latin", () => {
    expect(estimateTokens("глаза")).toBeGreaterThanOrEqual(2);
    expect(estimateTokens("hello")).toBeGreaterThanOrEqual(1);
  });
});

describe("shouldSkipPath", () => {
  test("skips vendor, git, lockfiles, binaries, public/gen", () => {
    expect(shouldSkipPath("node_modules/foo/index.js")).toBe(true);
    expect(shouldSkipPath("src/.git/config")).toBe(true);
    expect(shouldSkipPath("package-lock.json")).toBe(true);
    expect(shouldSkipPath("bun.lock")).toBe(true);
    expect(shouldSkipPath("public/gen/abc.png")).toBe(true);
    expect(shouldSkipPath("cover.png")).toBe(true);
    expect(shouldSkipPath("src/lib/agent.ts")).toBe(false);
    expect(shouldSkipPath("README.md")).toBe(false);
  });

  test("huge files are skipped by byte cap", () => {
    expect(shouldSkipFileBytes(1)).toBe(false);
    expect(shouldSkipFileBytes(MAX_INDEX_FILE_BYTES)).toBe(false);
    expect(shouldSkipFileBytes(MAX_INDEX_FILE_BYTES + 1)).toBe(true);
    expect(shouldSkipFileBytes(0)).toBe(true);
  });
});
