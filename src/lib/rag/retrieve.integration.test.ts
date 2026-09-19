/**
 * Scoped retrieve against live Postgres + pgvector.
 * Embeddings HTTP is mocked — no real OpenAI key.
 */

import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { PrismaClient } from "@prisma/client";

import { encryptSecret, last4OfKey } from "../ai/crypto";
import { retrieve } from "./retrieve";
import { ragScopeFromThread } from "./scope";
import { upsertChunk } from "./store";
import { RAG_EMBEDDING_DIM } from "./types";

const db = new PrismaClient();
const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

const originalFetch = globalThis.fetch;

function unitVec(hot: number): number[] {
  const v = new Array(RAG_EMBEDDING_DIM).fill(0);
  v[hot] = 1;
  return v;
}

describe.skipIf(SKIP_PG)("retrieve scope isolation (postgres)", () => {
  let userA = "";
  let userB = "";
  let book = "";
  let coder = "";

  async function seed() {
    if (userA) return;
    const a = await db.user.create({
      data: {
        email: `rag-a-${stamp}@example.test`,
        name: "Author",
        passwordHash: "x",
      },
    });
    const b = await db.user.create({
      data: {
        email: `rag-b-${stamp}@example.test`,
        name: "Other",
        passwordHash: "x",
      },
    });
    userA = a.id;
    userB = b.id;
    const bookRow = await db.project.create({
      data: { userId: userA, name: "Тишина", type: "book" },
    });
    const coderRow = await db.project.create({
      data: { userId: userA, name: "coder", type: "app" },
    });
    book = bookRow.id;
    coder = coderRow.id;
    await db.project.create({
      data: { userId: userB, name: "Чужая книга", type: "book" },
    });

    await upsertChunk(db, {
      userId: userA,
      projectId: book,
      sourceType: "section",
      sourceId: "sec-book",
      path: "гл. 2",
      ordinal: 0,
      content: "У Марины карие глаза. Тишина, глава 2.",
      tokenCount: 12,
      contentHash: "h-book",
      embedding: unitVec(0),
    });
    await upsertChunk(db, {
      userId: userA,
      projectId: coder,
      sourceType: "file",
      sourceId: `${coder}:src/agent.ts`,
      path: "src/agent.ts",
      ordinal: 0,
      content: "export function agent() { return 'sandbox'; }",
      tokenCount: 10,
      contentHash: "h-coder",
      embedding: unitVec(1),
    });
    await upsertChunk(db, {
      userId: userA,
      projectId: null,
      sourceType: "note",
      sourceId: "note-inbox",
      path: null,
      ordinal: 0,
      content: "инбокс: идея клипа без воркспейса",
      tokenCount: 8,
      contentHash: "h-inbox",
      embedding: unitVec(2),
    });
    await upsertChunk(db, {
      userId: userB,
      projectId: null,
      sourceType: "section",
      sourceId: "sec-other",
      path: null,
      ordinal: 0,
      content: "У Марины карие глаза — но это чужой канон.",
      tokenCount: 12,
      contentHash: "h-other",
      embedding: unitVec(0),
    });
  }

  test("keyword: workspace never includes another projectId", async () => {
    await seed();
    const result = await retrieve(db, {
      scope: ragScopeFromThread(userA, coder),
      query: "карие глаза agent sandbox",
      limit: 12,
    });
    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.every((h) => h.workspaceId === coder)).toBe(true);
    expect(result.hits.some((h) => h.workspaceId === book)).toBe(false);
    expect(result.hits.some((h) => h.workspaceId == null)).toBe(false);
    expect(result.hits.some((h) => h.excerpt.includes("чужой"))).toBe(false);
  });

  test("keyword: global includes multiple projects for one user", async () => {
    await seed();
    const result = await retrieve(db, {
      scope: ragScopeFromThread(userA, null),
      query: "карие глаза agent инбокс",
      limit: 12,
    });
    const projects = new Set(result.hits.map((h) => h.workspaceId));
    expect(projects.has(book)).toBe(true);
    expect(projects.has(coder)).toBe(true);
    expect(projects.has(null)).toBe(true);
    expect(result.hits.some((h) => h.excerpt.includes("чужой"))).toBe(false);
  });

  test("keyword: other users are isolated", async () => {
    await seed();
    const result = await retrieve(db, {
      scope: ragScopeFromThread(userB, null),
      query: "карие глаза",
      limit: 12,
    });
    expect(result.hits.every((h) => h.excerpt.includes("чужой"))).toBe(true);
    expect(result.hits.some((h) => h.workspaceId === book)).toBe(false);
    expect(result.hits.some((h) => h.workspaceId === coder)).toBe(false);
  });

  test("vector: mocked /v1/embeddings still honors workspace filter", async () => {
    await seed();
    const provider = await db.aiProvider.create({
      data: {
        userId: userA,
        kind: "openai_compatible",
        name: "Mock embeddings",
        baseUrl: "https://api.openai.com/v1",
        apiKey: encryptSecret("sk-test-embeddings"),
        apiKeyLast4: last4OfKey("sk-test-embeddings"),
        enabled: true,
      },
    });
    const model = await db.aiModel.create({
      data: {
        providerId: provider.id,
        modelId: "text-embedding-3-small",
        displayName: "embed-small",
        capChat: false,
        capEmbeddings: true,
        enabled: true,
      },
    });
    await db.userToolModel.create({
      data: { userId: userA, toolId: "embeddings", modelId: model.id },
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.openai.com/v1/embeddings");
      const body = JSON.parse(String(init?.body));
      expect(body.model).toBe("text-embedding-3-small");
      const text = Array.isArray(body.input) ? body.input[0] : body.input;
      const hot = String(text).includes("глаз") ? 0 : 1;
      return new Response(
        JSON.stringify({ data: [{ index: 0, embedding: unitVec(hot) }] }),
        { headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const workspace = await retrieve(db, {
      scope: ragScopeFromThread(userA, coder),
      query: "карие глаза Марины",
      limit: 8,
    });
    expect(workspace.mode).toBe("vector");
    expect(workspace.hits.every((h) => h.workspaceId === coder)).toBe(true);
    expect(workspace.hits.some((h) => h.workspaceId === book)).toBe(false);
    expect(workspace.hits.some((h) => h.excerpt.includes("Марины"))).toBe(false);

    const global = await retrieve(db, {
      scope: ragScopeFromThread(userA, null),
      query: "карие глаза Марины",
      limit: 8,
    });
    expect(global.mode).toBe("vector");
    expect(global.hits.length).toBeGreaterThan(0);
    expect(global.hits.some((h) => h.workspaceId === book)).toBe(true);
    expect(global.hits[0]?.workspaceId).toBe(book);
    expect(global.hits.some((h) => h.excerpt.includes("чужой"))).toBe(false);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (userA) await db.user.delete({ where: { id: userA } }).catch(() => {});
    if (userB) await db.user.delete({ where: { id: userB } }).catch(() => {});
    await db.$disconnect().catch(() => {});
  });
});
