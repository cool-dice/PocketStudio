import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { UNCONFIGURED_EMBEDDINGS_MESSAGE } from "@/lib/rag/types";
import { upsertChunk } from "@/lib/rag/store";

import { POST as reindex } from "./reindex/route";
import { POST as search } from "./search/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

function jsonRequest(
  url: string,
  body: unknown,
  bearer?: string,
): Request {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("POST /api/rag", () => {
  let userId: string | null = null;
  let otherId: string | null = null;
  let token: string | null = null;
  let bookId: string | null = null;
  let appId: string | null = null;

  test("search scopes workspace vs global; reindex needs embeddings", async () => {
    const user = await db.user.create({
      data: {
        name: "RagApi",
        email: `rag-api-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    userId = user.id;
    token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    const other = await db.user.create({
      data: {
        name: "Other",
        email: `rag-api-other-${stamp}@example.test`,
        passwordHash: "x",
        role: "client",
      },
    });
    otherId = other.id;

    const book = await db.project.create({
      data: { userId: user.id, name: "Тишина", type: "book" },
    });
    const app = await db.project.create({
      data: { userId: user.id, name: "coder", type: "app" },
    });
    bookId = book.id;
    appId = app.id;

    await upsertChunk(db, {
      userId: user.id,
      projectId: book.id,
      sourceType: "section",
      sourceId: "api-sec",
      path: "гл. 2",
      ordinal: 0,
      content: "карие глаза Марины в книге Тишина",
      tokenCount: 8,
      contentHash: "api-book",
      embedding: null,
    });
    await upsertChunk(db, {
      userId: user.id,
      projectId: app.id,
      sourceType: "file",
      sourceId: `${app.id}:src/a.ts`,
      path: "src/a.ts",
      ordinal: 0,
      content: "export function agent() { return 1 }",
      tokenCount: 8,
      contentHash: "api-app",
      embedding: null,
    });
    await upsertChunk(db, {
      userId: other.id,
      projectId: null,
      sourceType: "note",
      sourceId: "api-other",
      path: null,
      ordinal: 0,
      content: "карие глаза чужого пользователя",
      tokenCount: 6,
      contentHash: "api-other",
      embedding: null,
    });

    const ws = await search(
      jsonRequest(
        "http://localhost/api/rag/search",
        {
          query: "карие глаза agent",
          threadProjectId: app.id,
        },
        token,
      ),
    );
    expect(ws.status).toBe(200);
    const wsJson = (await ws.json()) as {
      scope: string;
      mode: string;
      hits: Array<{ workspaceId: string | null; excerpt: string }>;
    };
    expect(wsJson.scope).toBe("workspace");
    expect(wsJson.mode).toBe("keyword");
    expect(wsJson.hits.every((h) => h.workspaceId === app.id)).toBe(true);
    expect(wsJson.hits.some((h) => h.excerpt.includes("Тишина"))).toBe(false);
    expect(wsJson.hits.some((h) => h.excerpt.includes("чужого"))).toBe(false);

    const ignored = await search(
      jsonRequest(
        "http://localhost/api/rag/search",
        {
          query: "карие глаза",
          threadProjectId: app.id,
          projectId: book.id,
        },
        token,
      ),
    );
    expect(ignored.status).toBe(200);
    const ignoredJson = (await ignored.json()) as {
      scope: string;
      hits: Array<{ workspaceId: string | null; excerpt: string }>;
    };
    expect(ignoredJson.scope).toBe("workspace");
    expect(ignoredJson.hits.every((h) => h.workspaceId === app.id)).toBe(true);
    expect(ignoredJson.hits.some((h) => h.excerpt.includes("Тишина"))).toBe(
      false,
    );

    const global = await search(
      jsonRequest(
        "http://localhost/api/rag/search",
        { query: "карие глаза agent", threadProjectId: null },
        token,
      ),
    );
    expect(global.status).toBe(200);
    const gJson = (await global.json()) as {
      scope: string;
      hits: Array<{ workspaceId: string | null; excerpt: string }>;
    };
    expect(gJson.scope).toBe("global");
    const projects = new Set(gJson.hits.map((h) => h.workspaceId));
    expect(projects.has(book.id)).toBe(true);
    expect(projects.has(app.id)).toBe(true);
    expect(gJson.hits.some((h) => h.excerpt.includes("чужого"))).toBe(false);

    const denied = await reindex(
      jsonRequest("http://localhost/api/rag/reindex", {}, token),
    );
    expect(denied.status).toBe(400);
    const deniedJson = (await denied.json()) as { error: string };
    expect(deniedJson.error).toBe(UNCONFIGURED_EMBEDDINGS_MESSAGE);
  });

  afterAll(async () => {
    if (userId) await db.user.delete({ where: { id: userId } }).catch(() => {});
    if (otherId) await db.user.delete({ where: { id: otherId } }).catch(() => {});
  });
});
