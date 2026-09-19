import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as search } from "./route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const SECRET = `маяк-idor-${stamp}`;
const ids: string[] = [];

function jsonRequest(url: string, bearer?: string): Request {
  const headers = new Headers({ accept: "application/json" });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, { method: "GET", headers });
}

describe.skipIf(SKIP_PG)("GET /api/search: scope, empty, IDOR", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `search-${label}-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    const token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return { user, token };
  }

  test("401 without auth; short query is empty not an error", async () => {
    const anon = await search(jsonRequest("http://localhost/api/search?q=маяк"));
    expect(anon.status).toBe(401);

    const { token } = await seedUser("short");
    const short = await search(
      jsonRequest("http://localhost/api/search?q=м", token),
    );
    expect(short.status).toBe(200);
    const json = (await short.json()) as {
      threads: unknown[];
      notes: unknown[];
      projects: unknown[];
      total: number;
    };
    expect(json.total).toBe(0);
    expect(json.threads).toEqual([]);
    expect(json.notes).toEqual([]);
    expect(json.projects).toEqual([]);
  });

  test("owner finds own data; attacker gets empty; foreign workspaceId is 404", async () => {
    const owner = await seedUser("owner");
    const attacker = await seedUser("atk");

    const ws = await db.project.create({
      data: {
        userId: owner.user.id,
        name: `Воркспейс ${SECRET}`,
        description: "личный конвейер",
        type: "book",
      },
    });
    const otherWs = await db.project.create({
      data: {
        userId: owner.user.id,
        name: "Другой воркспейс без секрета",
        type: "music",
      },
    });
    const note = await db.note.create({
      data: { userId: owner.user.id, rawText: `заметка ${SECRET} про фьорд` },
    });
    await db.noteLink.create({
      data: { noteId: note.id, projectId: ws.id },
    });
    const strayNote = await db.note.create({
      data: {
        userId: owner.user.id,
        rawText: `чужой контекст ${SECRET} в музыке`,
      },
    });
    await db.noteLink.create({
      data: { noteId: strayNote.id, projectId: otherWs.id },
    });
    const thread = await db.thread.create({
      data: {
        userId: owner.user.id,
        title: `Диалог ${SECRET}`,
        mode: "ask",
        projectId: ws.id,
      },
    });
    await db.message.create({
      data: {
        threadId: thread.id,
        role: "user",
        content: `как устроен ${SECRET}`,
      },
    });

    const hit = await search(
      jsonRequest(
        `http://localhost/api/search?q=${encodeURIComponent(SECRET)}`,
        owner.token,
      ),
    );
    expect(hit.status).toBe(200);
    const found = (await hit.json()) as {
      threads: Array<{ id: string; title: string }>;
      notes: Array<{ id: string; preview: string }>;
      projects: Array<{ id: string; name: string }>;
      total: number;
    };
    expect(found.projects.some((p) => p.id === ws.id)).toBe(true);
    expect(found.projects.some((p) => p.id.startsWith("ws-"))).toBe(false);
    expect(found.notes.some((n) => n.id === note.id)).toBe(true);
    expect(found.threads.some((t) => t.id === thread.id)).toBe(true);
    expect(found.total).toBeGreaterThan(0);

    const scoped = await search(
      jsonRequest(
        `http://localhost/api/search?q=${encodeURIComponent(SECRET)}&workspaceId=${ws.id}`,
        owner.token,
      ),
    );
    expect(scoped.status).toBe(200);
    const scopedJson = (await scoped.json()) as {
      notes: Array<{ id: string }>;
      projects: Array<{ id: string }>;
      threads: Array<{ id: string }>;
    };
    expect(scopedJson.projects.map((p) => p.id)).toEqual([ws.id]);
    expect(scopedJson.notes.map((n) => n.id)).toEqual([note.id]);
    expect(scopedJson.threads.map((t) => t.id)).toEqual([thread.id]);
    expect(JSON.stringify(scopedJson)).not.toContain(strayNote.id);
    expect(JSON.stringify(scopedJson)).not.toContain(otherWs.id);

    const stolen = await search(
      jsonRequest(
        `http://localhost/api/search?q=${encodeURIComponent(SECRET)}`,
        attacker.token,
      ),
    );
    expect(stolen.status).toBe(200);
    const stolenJson = (await stolen.json()) as {
      threads: unknown[];
      notes: unknown[];
      projects: unknown[];
      total: number;
    };
    expect(stolenJson.total).toBe(0);
    expect(stolenJson.threads).toEqual([]);
    expect(stolenJson.notes).toEqual([]);
    expect(stolenJson.projects).toEqual([]);
    expect(JSON.stringify(stolenJson)).not.toContain(SECRET);
    expect(JSON.stringify(stolenJson)).not.toContain(ws.id);
    expect(JSON.stringify(stolenJson)).not.toContain(note.id);

    const idorWs = await search(
      jsonRequest(
        `http://localhost/api/search?q=${encodeURIComponent(SECRET)}&workspaceId=${ws.id}`,
        attacker.token,
      ),
    );
    expect(idorWs.status).toBe(404);
    const idorJson = (await idorWs.json()) as {
      error: string;
      threads?: unknown;
      notes?: unknown;
      projects?: unknown;
    };
    expect(idorJson.error).toMatch(/не найден/i);
    expect(idorJson.threads).toBeUndefined();
    expect(idorJson.notes).toBeUndefined();
    expect(idorJson.projects).toBeUndefined();
    expect(JSON.stringify(idorJson)).not.toContain(SECRET);
  });
});
