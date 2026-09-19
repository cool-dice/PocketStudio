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
import { embeddingsConfigured } from "./embed";
import { RAG_EMBEDDING_DIM, RAG_KEYWORD_NOTICE } from "./types";

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
  let bookSectionId = "";
  let inboxNoteId = "";
  let otherSectionId = "";
  let archived = "";

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
    const archivedRow = await db.project.create({
      data: { userId: userA, name: "Архив", type: "book", archived: true },
    });
    book = bookRow.id;
    coder = coderRow.id;
    archived = archivedRow.id;
    await db.project.create({
      data: { userId: userB, name: "Чужая книга", type: "book" },
    });

    const bookDoc = await db.document.create({
      data: { projectId: book, title: "Тишина" },
    });
    const bookSec = await db.documentSection.create({
      data: {
        documentId: bookDoc.id,
        title: "гл. 2",
        content: "У Марины карие глаза. Тишина, глава 2.",
      },
    });
    bookSectionId = bookSec.id;

    const inbox = await db.note.create({
      data: {
        userId: userA,
        rawText: "инбокс: идея клипа без воркспейса",
      },
    });
    inboxNoteId = inbox.id;

    const otherBook = await db.project.findFirst({
      where: { userId: userB, name: "Чужая книга" },
    });
    const otherDoc = await db.document.create({
      data: { projectId: otherBook!.id, title: "Чужое" },
    });
    const otherSec = await db.documentSection.create({
      data: {
        documentId: otherDoc.id,
        title: "гл. 1",
        content: "У Марины карие глаза — но это чужой канон.",
      },
    });
    otherSectionId = otherSec.id;

    const archivedDoc = await db.document.create({
      data: { projectId: archived, title: "Старое" },
    });
    const archivedSec = await db.documentSection.create({
      data: {
        documentId: archivedDoc.id,
        title: "архив",
        content: "заархивированная глава про маяк",
      },
    });

    await upsertChunk(db, {
      userId: userA,
      projectId: book,
      sourceType: "section",
      sourceId: bookSectionId,
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
      sourceId: inboxNoteId,
      path: null,
      ordinal: 0,
      content: "инбокс: идея клипа без воркспейса",
      tokenCount: 8,
      contentHash: "h-inbox",
      embedding: unitVec(2),
    });
    await upsertChunk(db, {
      userId: userB,
      projectId: otherBook!.id,
      sourceType: "section",
      sourceId: otherSectionId,
      path: null,
      ordinal: 0,
      content: "У Марины карие глаза — но это чужой канон.",
      tokenCount: 12,
      contentHash: "h-other",
      embedding: unitVec(0),
    });
    await upsertChunk(db, {
      userId: userA,
      projectId: archived,
      sourceType: "section",
      sourceId: archivedSec.id,
      path: "архив",
      ordinal: 0,
      content: "заархивированная глава про маяк",
      tokenCount: 8,
      contentHash: "h-arch",
      embedding: unitVec(3),
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

  test("global retrieve skips archived workspaces", async () => {
    await seed();
    const result = await retrieve(db, {
      scope: ragScopeFromThread(userA, null),
      query: "заархивированная глава маяк",
      limit: 12,
    });
    expect(result.hits.some((h) => h.workspaceId === archived)).toBe(false);
  });

  test("deleted note is dropped even if the chunk remains", async () => {
    await seed();
    await db.note.delete({ where: { id: inboxNoteId } });
    const result = await retrieve(db, {
      scope: ragScopeFromThread(userA, null),
      query: "инбокс идея клипа",
      limit: 12,
    });
    expect(result.hits.some((h) => h.sourceId === inboxNoteId)).toBe(false);
    expect(result.hits.some((h) => h.excerpt.includes("инбокс"))).toBe(false);
  });

  test("deleted document sections disappear from retrieve", async () => {
    await seed();
    const goneDoc = await db.document.create({
      data: { projectId: book, title: "Черновик на выброс" },
    });
    const goneSec = await db.documentSection.create({
      data: {
        documentId: goneDoc.id,
        title: "удалённая глава",
        content: "уникальный фрагмент про маяк который исчезнет",
      },
    });
    await upsertChunk(db, {
      userId: userA,
      projectId: book,
      sourceType: "section",
      sourceId: goneSec.id,
      path: "удалённая глава",
      ordinal: 0,
      content: "уникальный фрагмент про маяк который исчезнет",
      tokenCount: 10,
      contentHash: "h-del-doc",
      embedding: unitVec(4),
    });
    const before = await retrieve(db, {
      scope: ragScopeFromThread(userA, book),
      query: "уникальный фрагмент про маяк который исчезнет",
      limit: 12,
    });
    expect(before.hits.some((h) => h.sourceId === goneSec.id)).toBe(true);

    const { DELETE: deleteDocument } = await import("../../app/api/documents/[id]/route");
    const { signSession } = await import("../auth");
    const owner = await db.user.findUnique({ where: { id: userA } });
    const token = await signSession({
      sub: userA,
      email: owner!.email,
      name: owner!.name,
      role: owner!.role,
    });
    const del = await deleteDocument(
      new Request(`http://localhost/api/documents/${goneDoc.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: goneDoc.id }) },
    );
    expect(del.status).toBe(200);

    const after = await retrieve(db, {
      scope: ragScopeFromThread(userA, book),
      query: "уникальный фрагмент про маяк который исчезнет",
      limit: 12,
    });
    expect(after.hits.some((h) => h.sourceId === goneSec.id)).toBe(false);
    expect(after.hits.some((h) => h.excerpt.includes("исчезнет"))).toBe(false);
  });

  test("deleted file on disk is dropped from retrieve", async () => {
    await seed();
    const { writeWorkspaceFile, deleteWorkspacePath, projectRoot, removeProjectDir } =
      await import("../workspace");
    const rel = "src/gone.ts";
    const body = "export const goneMarker = 'удалённый файл маяк';";
    await writeWorkspaceFile(projectRoot(coder), rel, body);
    await upsertChunk(db, {
      userId: userA,
      projectId: coder,
      sourceType: "file",
      sourceId: `${coder}:${rel}`,
      path: rel,
      ordinal: 0,
      content: body,
      tokenCount: 8,
      contentHash: "h-del-file",
      embedding: unitVec(5),
    });
    const before = await retrieve(db, {
      scope: ragScopeFromThread(userA, coder),
      query: "удалённый файл маяк goneMarker",
      limit: 12,
    });
    expect(before.hits.some((h) => h.path === rel)).toBe(true);

    await deleteWorkspacePath(projectRoot(coder), rel);

    const after = await retrieve(db, {
      scope: ragScopeFromThread(userA, coder),
      query: "удалённый файл маяк goneMarker",
      limit: 12,
    });
    expect(after.hits.some((h) => h.path === rel)).toBe(false);

    await removeProjectDir(coder).catch(() => {});
  });

  test("unconfigured embeddings: keyword fallback stays scoped, no HTTP, no invented vectors", async () => {
    await seed();
    await db.userToolModel
      .deleteMany({ where: { userId: userA, toolId: "embeddings" } })
      .catch(() => {});
    const configured = await embeddingsConfigured(db, userA);

    let fetchCalls = 0;
    if (!configured) {
      globalThis.fetch = (async () => {
        fetchCalls += 1;
        await new Promise((r) => setTimeout(r, 30_000));
        return new Response("should not hang", { status: 500 });
      }) as typeof fetch;
    }

    const started = Date.now();
    const workspace = await retrieve(db, {
      scope: ragScopeFromThread(userA, coder),
      query: "карие глаза agent sandbox",
      limit: 12,
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    if (!configured) expect(fetchCalls).toBe(0);
    expect(workspace.mode).toBe("keyword");
    expect(workspace.notice).toBe(RAG_KEYWORD_NOTICE);
    expect(workspace.hits.every((h) => h.workspaceId === coder)).toBe(true);
    expect(workspace.hits.some((h) => h.workspaceId === book)).toBe(false);
    expect(workspace.hits.some((h) => h.excerpt.includes("чужой"))).toBe(false);

    const global = await retrieve(db, {
      scope: ragScopeFromThread(userA, null),
      query: "карие глаза agent инбокс",
      limit: 12,
    });
    if (!configured) expect(fetchCalls).toBe(0);
    expect(global.mode).toBe("keyword");
    expect(global.notice).toBe(RAG_KEYWORD_NOTICE);
    const projects = new Set(global.hits.map((h) => h.workspaceId));
    expect(projects.has(book)).toBe(true);
    expect(projects.has(coder)).toBe(true);
    expect(global.hits.some((h) => h.excerpt.includes("чужой"))).toBe(false);
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

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    if (userA) {
      await db.userToolModel
        .deleteMany({ where: { userId: userA, toolId: "embeddings" } })
        .catch(() => {});
    }
  });

  afterAll(async () => {
    globalThis.fetch = originalFetch;
    if (userA) await db.user.delete({ where: { id: userA } }).catch(() => {});
    if (userB) await db.user.delete({ where: { id: userB } }).catch(() => {});
    await db.$disconnect().catch(() => {});
  });
});
