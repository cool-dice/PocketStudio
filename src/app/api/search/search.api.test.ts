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
      documents: unknown[];
      entities: unknown[];
      artifacts: unknown[];
      total: number;
    };
    expect(json.total).toBe(0);
    expect(json.threads).toEqual([]);
    expect(json.notes).toEqual([]);
    expect(json.projects).toEqual([]);
    expect(json.documents).toEqual([]);
    expect(json.entities).toEqual([]);
    expect(json.artifacts).toEqual([]);
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
        origin: "workspace",
      },
    });
    const otherWs = await db.project.create({
      data: {
        userId: owner.user.id,
        name: "Другой воркспейс без секрета",
        type: "music",
        origin: "workspace",
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
      threads: Array<{ id: string; title: string; projectOrigin?: string | null }>;
      notes: Array<{ id: string; preview: string }>;
      projects: Array<{ id: string; name: string }>;
      total: number;
    };
    expect(found.projects.some((p) => p.id === ws.id)).toBe(true);
    expect(found.projects.some((p) => p.id.startsWith("ws-"))).toBe(false);
    expect(found.notes.some((n) => n.id === note.id)).toBe(true);
    expect(found.threads.some((t) => t.id === thread.id)).toBe(true);
    const bound = found.threads.find((t) => t.id === thread.id);
    expect(bound?.projectOrigin).toBe("workspace");
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
      documents: unknown[];
      entities: unknown[];
      artifacts: unknown[];
      total: number;
    };
    expect(stolenJson.total).toBe(0);
    expect(stolenJson.threads).toEqual([]);
    expect(stolenJson.notes).toEqual([]);
    expect(stolenJson.projects).toEqual([]);
    expect(stolenJson.documents).toEqual([]);
    expect(stolenJson.entities).toEqual([]);
    expect(stolenJson.artifacts).toEqual([]);
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
      documents?: unknown;
      entities?: unknown;
      artifacts?: unknown;
    };
    expect(idorJson.error).toMatch(/не найден/i);
    expect(idorJson.threads).toBeUndefined();
    expect(idorJson.notes).toBeUndefined();
    expect(idorJson.projects).toBeUndefined();
    expect(idorJson.documents).toBeUndefined();
    expect(idorJson.entities).toBeUndefined();
    expect(idorJson.artifacts).toBeUndefined();
    expect(JSON.stringify(idorJson)).not.toContain(SECRET);
  });

  test("owner finds documents, entities, artifacts; attacker IDOR; archived skipped; no body dump", async () => {
    const owner = await seedUser("studio");
    const attacker = await seedUser("studio-atk");
    const BODY = `тело-dump-${stamp}-${"я".repeat(2500)}`;

    const ws = await db.project.create({
      data: {
        userId: owner.user.id,
        name: "Книга без секрета в имени",
        type: "book",
      },
    });
    const film = await db.project.create({
      data: {
        userId: owner.user.id,
        name: "Фильм без секрета в имени",
        type: "film",
      },
    });
    const otherWs = await db.project.create({
      data: {
        userId: owner.user.id,
        name: "Другая полка",
        type: "book",
      },
    });
    const archived = await db.project.create({
      data: {
        userId: owner.user.id,
        name: "Архив",
        type: "book",
        archived: true,
      },
    });

    const doc = await db.document.create({
      data: {
        projectId: ws.id,
        title: `Рукопись ${SECRET}`,
        kind: "manuscript",
        description: BODY,
      },
    });
    const strayDoc = await db.document.create({
      data: {
        projectId: otherWs.id,
        title: `Чужая рукопись ${SECRET}`,
        kind: "article",
      },
    });
    const archivedDoc = await db.document.create({
      data: {
        projectId: archived.id,
        title: `Архивная ${SECRET}`,
        kind: "manuscript",
        description: BODY,
      },
    });
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: `Марина ${SECRET}`,
        short: "смотрит на фьорд",
        description: BODY,
      },
    });
    const archivedEntity = await db.entity.create({
      data: {
        projectId: archived.id,
        kind: "character",
        name: `Архивная сущность ${SECRET}`,
        description: BODY,
      },
    });
    const image = await db.artifact.create({
      data: {
        projectId: film.id,
        type: "image",
        title: `Кадр ${SECRET}`,
        prompt: BODY,
        description: BODY,
      },
    });
    const audio = await db.artifact.create({
      data: {
        projectId: ws.id,
        type: "audio",
        title: `Голос ${SECRET}`,
        prompt: BODY,
      },
    });
    const archivedArt = await db.artifact.create({
      data: {
        projectId: archived.id,
        type: "image",
        title: `Архивный кадр ${SECRET}`,
        prompt: BODY,
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
      documents: Array<{ id: string; title: string; href: string; snippet: string }>;
      entities: Array<{ id: string; name: string; href: string; snippet: string }>;
      artifacts: Array<{
        id: string;
        title: string;
        kind: string;
        href: string;
        snippet: string;
      }>;
      total: number;
    };
    expect(found.documents.some((d) => d.id === doc.id)).toBe(true);
    expect(found.documents.find((d) => d.id === doc.id)?.href).toBe(
      `/w/${ws.id}?tab=documents&doc=${doc.id}`,
    );
    expect(found.entities.some((e) => e.id === entity.id)).toBe(true);
    expect(found.entities.find((e) => e.id === entity.id)?.href).toContain(
      "tab=documents",
    );
    expect(found.artifacts.some((a) => a.id === image.id)).toBe(true);
    expect(found.artifacts.find((a) => a.id === image.id)?.href).toBe(
      `/w/${film.id}?tab=images`,
    );
    expect(found.artifacts.find((a) => a.id === audio.id)?.href).toBe(
      "/?area=library",
    );
    expect(found.documents.some((d) => d.id === archivedDoc.id)).toBe(false);
    expect(found.entities.some((e) => e.id === archivedEntity.id)).toBe(false);
    expect(found.artifacts.some((a) => a.id === archivedArt.id)).toBe(false);
    expect(found.total).toBeGreaterThan(0);

    const payload = JSON.stringify(found);
    expect(payload).not.toContain(BODY);
    expect(payload).not.toContain("тело-dump-");
    for (const row of [...found.documents, ...found.entities, ...found.artifacts]) {
      expect(row.snippet.length).toBeLessThan(200);
    }

    const scoped = await search(
      jsonRequest(
        `http://localhost/api/search?q=${encodeURIComponent(SECRET)}&workspaceId=${ws.id}`,
        owner.token,
      ),
    );
    expect(scoped.status).toBe(200);
    const scopedJson = (await scoped.json()) as {
      documents: Array<{ id: string }>;
      entities: Array<{ id: string }>;
      artifacts: Array<{ id: string }>;
    };
    expect(scopedJson.documents.map((d) => d.id)).toEqual([doc.id]);
    expect(scopedJson.entities.map((e) => e.id)).toEqual([entity.id]);
    expect(scopedJson.artifacts.map((a) => a.id)).toEqual([audio.id]);
    expect(JSON.stringify(scopedJson)).not.toContain(strayDoc.id);
    expect(JSON.stringify(scopedJson)).not.toContain(image.id);
    expect(JSON.stringify(scopedJson)).not.toContain(film.id);

    const kindHit = await search(
      jsonRequest(
        `http://localhost/api/search?q=audio&workspaceId=${ws.id}`,
        owner.token,
      ),
    );
    expect(kindHit.status).toBe(200);
    const kindJson = (await kindHit.json()) as {
      artifacts: Array<{ id: string; kind: string }>;
    };
    expect(kindJson.artifacts.some((a) => a.id === audio.id && a.kind === "audio")).toBe(
      true,
    );

    const stolen = await search(
      jsonRequest(
        `http://localhost/api/search?q=${encodeURIComponent(SECRET)}`,
        attacker.token,
      ),
    );
    expect(stolen.status).toBe(200);
    const stolenJson = (await stolen.json()) as {
      documents: unknown[];
      entities: unknown[];
      artifacts: unknown[];
      total: number;
    };
    expect(stolenJson.total).toBe(0);
    expect(stolenJson.documents).toEqual([]);
    expect(stolenJson.entities).toEqual([]);
    expect(stolenJson.artifacts).toEqual([]);
    expect(JSON.stringify(stolenJson)).not.toContain(SECRET);
    expect(JSON.stringify(stolenJson)).not.toContain(doc.id);
    expect(JSON.stringify(stolenJson)).not.toContain(entity.id);
    expect(JSON.stringify(stolenJson)).not.toContain(image.id);

    const idorWs = await search(
      jsonRequest(
        `http://localhost/api/search?q=${encodeURIComponent(SECRET)}&workspaceId=${ws.id}`,
        attacker.token,
      ),
    );
    expect(idorWs.status).toBe(404);
    const idorJson = (await idorWs.json()) as {
      error: string;
      documents?: unknown;
      entities?: unknown;
      artifacts?: unknown;
    };
    expect(idorJson.error).toMatch(/не найден/i);
    expect(idorJson.documents).toBeUndefined();
    expect(idorJson.entities).toBeUndefined();
    expect(idorJson.artifacts).toBeUndefined();
    expect(JSON.stringify(idorJson)).not.toContain(SECRET);
    expect(JSON.stringify(idorJson)).not.toContain(BODY);
  });
});
