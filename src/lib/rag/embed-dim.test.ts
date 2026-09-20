import { describe, expect, test } from "bun:test";

import { EMBEDDING_DIM_MISMATCH_MESSAGE, RAG_EMBEDDING_DIM } from "./types";

describe("embedding dimension contract", () => {
  test("product index is 1536 and mismatch copy is Russian", () => {
    expect(RAG_EMBEDDING_DIM).toBe(1536);
    expect(EMBEDDING_DIM_MISMATCH_MESSAGE).toMatch(/1536/);
    expect(EMBEDDING_DIM_MISMATCH_MESSAGE).toMatch(/измерений/);
    expect(EMBEDDING_DIM_MISMATCH_MESSAGE).toMatch(/Модели ИИ/);
  });
});
