import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as getWorkspace } from "./workspaces/[id]/route";
import { GET as getNote } from "./notes/[id]/route";
import { POST as searchRag } from "./rag/search/route";
import { GET as getThread, PATCH as patchThread, DELETE as deleteThread } from "./threads/[id]/route";
import {
  GET as getDocument,
  PATCH as patchDocument,
  DELETE as deleteDocument,
} from "./documents/[id]/route";
import { POST as addSection } from "./documents/[id]/sections/route";
import { PATCH as patchSection, DELETE as deleteSection } from "./sections/[id]/route";
import {
  GET as getEntity,
  PATCH as patchEntity,
  DELETE as deleteEntity,
} from "./entities/[id]/route";
import { PATCH as patchArtifact, DELETE as deleteArtifact } from "./artifacts/[id]/route";
import { PATCH as patchFinding } from "./findings/[id]/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  bearer?: string,
): Request {
  const headers = new Headers({ accept: "application/json" });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("IDOR: other user's ids are 404", () => {
  let ownerId: string | null = null;
  let attackerId: string | null = null;
  let attackerToken: string | null = null;

  async function seedAttacker() {
    if (attackerToken && ownerId) return;
    const owner = await db.user.create({
      data: {
        name: "Owner",
        email: `idor-owner-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ownerId = owner.id;
    const attacker = await db.user.create({
      data: {
        name: "Attacker",
        email: `idor-atk-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    attackerId = attacker.id;
    attackerToken = await signSession({
      sub: attacker.id,
      email: attacker.email,
      name: attacker.name,
      role: attacker.role,
    });
  }

  test("workspace, note, and rag search do not leak another user", async () => {
    await seedAttacker();
    const ws = await db.project.create({
      data: { userId: ownerId!, name: "Секрет", type: "book" },
    });
    const note = await db.note.create({
      data: { userId: ownerId!, rawText: "секретная заметка владельца" },
    });

    const wsRes = await getWorkspace(
      jsonRequest(`http://localhost/api/workspaces/${ws.id}`, "GET", undefined, attackerToken!),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(wsRes.status).toBe(404);
    const wsJson = (await wsRes.json()) as { error: string; workspace?: unknown };
    expect(wsJson.workspace).toBeUndefined();
    expect(wsJson.error).toMatch(/не найден/i);

    const noteRes = await getNote(
      jsonRequest(`http://localhost/api/notes/${note.id}`, "GET", undefined, attackerToken!),
      { params: Promise.resolve({ id: note.id }) },
    );
    expect(noteRes.status).toBe(404);
    const noteJson = (await noteRes.json()) as { note?: unknown };
    expect(noteJson.note).toBeUndefined();

    const rag = await searchRag(
      jsonRequest(
        "http://localhost/api/rag/search",
        "POST",
        { query: "секретная", threadProjectId: ws.id },
        attackerToken!,
      ),
    );
    expect(rag.status).toBe(404);
  });

  test("thread GET/PATCH/DELETE are 404 for another user", async () => {
    await seedAttacker();
    const thread = await db.thread.create({
      data: { userId: ownerId!, title: "Секретный диалог", mode: "ask" },
    });
    const params = { params: Promise.resolve({ id: thread.id }) };

    const got = await getThread(
      jsonRequest(`http://localhost/api/threads/${thread.id}`, "GET", undefined, attackerToken!),
      params,
    );
    expect(got.status).toBe(404);
    const gotJson = (await got.json()) as { thread?: unknown; messages?: unknown };
    expect(gotJson.thread).toBeUndefined();
    expect(gotJson.messages).toBeUndefined();

    const patched = await patchThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "PATCH",
        { title: "взлом" },
        attackerToken!,
      ),
      params,
    );
    expect(patched.status).toBe(404);

    const deleted = await deleteThread(
      jsonRequest(
        `http://localhost/api/threads/${thread.id}`,
        "DELETE",
        undefined,
        attackerToken!,
      ),
      params,
    );
    expect(deleted.status).toBe(404);

    const still = await db.thread.findUnique({ where: { id: thread.id } });
    expect(still?.title).toBe("Секретный диалог");
  });

  test("document/section GET/PATCH/DELETE are 404 for another user", async () => {
    await seedAttacker();
    const ws = await db.project.create({
      data: { userId: ownerId!, name: "Книга", type: "book" },
    });
    const document = await db.document.create({
      data: { projectId: ws.id, title: "Канон" },
    });
    const section = await db.documentSection.create({
      data: { documentId: document.id, title: "гл. 1", content: "секрет главы" },
    });
    const docParams = { params: Promise.resolve({ id: document.id }) };
    const secParams = { params: Promise.resolve({ id: section.id }) };

    const got = await getDocument(
      jsonRequest(`http://localhost/api/documents/${document.id}`, "GET", undefined, attackerToken!),
      docParams,
    );
    expect(got.status).toBe(404);
    const gotJson = (await got.json()) as { document?: unknown };
    expect(gotJson.document).toBeUndefined();

    const patched = await patchDocument(
      jsonRequest(
        `http://localhost/api/documents/${document.id}`,
        "PATCH",
        { title: "взлом" },
        attackerToken!,
      ),
      docParams,
    );
    expect(patched.status).toBe(404);

    const added = await addSection(
      jsonRequest(
        `http://localhost/api/documents/${document.id}/sections`,
        "POST",
        { title: "чужая глава" },
        attackerToken!,
      ),
      docParams,
    );
    expect(added.status).toBe(404);

    const secPatch = await patchSection(
      jsonRequest(
        `http://localhost/api/sections/${section.id}`,
        "PATCH",
        { content: "взлом" },
        attackerToken!,
      ),
      secParams,
    );
    expect(secPatch.status).toBe(404);

    const secDel = await deleteSection(
      jsonRequest(
        `http://localhost/api/sections/${section.id}`,
        "DELETE",
        undefined,
        attackerToken!,
      ),
      secParams,
    );
    expect(secDel.status).toBe(404);

    const deleted = await deleteDocument(
      jsonRequest(
        `http://localhost/api/documents/${document.id}`,
        "DELETE",
        undefined,
        attackerToken!,
      ),
      docParams,
    );
    expect(deleted.status).toBe(404);

    const stillDoc = await db.document.findUnique({ where: { id: document.id } });
    const stillSec = await db.documentSection.findUnique({ where: { id: section.id } });
    expect(stillDoc?.title).toBe("Канон");
    expect(stillSec?.content).toBe("секрет главы");
  });

  test("entity/artifact/finding mutations are 404 for another user", async () => {
    await seedAttacker();
    const ws = await db.project.create({
      data: { userId: ownerId!, name: "Студия", type: "book" },
    });
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: "Марина",
        description: "героиня",
      },
    });
    const artifact = await db.artifact.create({
      data: { projectId: ws.id, type: "image", title: "портрет" },
    });
    const finding = await db.finding.create({
      data: {
        projectId: ws.id,
        type: "omission",
        title: "дыра",
        quote: "цитата",
        advice: "исправить",
      },
    });

    const entGet = await getEntity(
      jsonRequest(`http://localhost/api/entities/${entity.id}`, "GET", undefined, attackerToken!),
      { params: Promise.resolve({ id: entity.id }) },
    );
    expect(entGet.status).toBe(404);
    const entJson = (await entGet.json()) as { entity?: unknown };
    expect(entJson.entity).toBeUndefined();

    const entPatch = await patchEntity(
      jsonRequest(
        `http://localhost/api/entities/${entity.id}`,
        "PATCH",
        { name: "взлом" },
        attackerToken!,
      ),
      { params: Promise.resolve({ id: entity.id }) },
    );
    expect(entPatch.status).toBe(404);

    const entDel = await deleteEntity(
      jsonRequest(
        `http://localhost/api/entities/${entity.id}`,
        "DELETE",
        undefined,
        attackerToken!,
      ),
      { params: Promise.resolve({ id: entity.id }) },
    );
    expect(entDel.status).toBe(404);

    const artPatch = await patchArtifact(
      jsonRequest(
        `http://localhost/api/artifacts/${artifact.id}`,
        "PATCH",
        { title: "взлом" },
        attackerToken!,
      ),
      { params: Promise.resolve({ id: artifact.id }) },
    );
    expect(artPatch.status).toBe(404);

    const artDel = await deleteArtifact(
      jsonRequest(
        `http://localhost/api/artifacts/${artifact.id}`,
        "DELETE",
        undefined,
        attackerToken!,
      ),
      { params: Promise.resolve({ id: artifact.id }) },
    );
    expect(artDel.status).toBe(404);

    const findPatch = await patchFinding(
      jsonRequest(
        `http://localhost/api/findings/${finding.id}`,
        "PATCH",
        { status: "fixed" },
        attackerToken!,
      ),
      { params: Promise.resolve({ id: finding.id }) },
    );
    expect(findPatch.status).toBe(404);

    const stillEnt = await db.entity.findUnique({ where: { id: entity.id } });
    const stillArt = await db.artifact.findUnique({ where: { id: artifact.id } });
    const stillFind = await db.finding.findUnique({ where: { id: finding.id } });
    expect(stillEnt?.name).toBe("Марина");
    expect(stillArt?.title).toBe("портрет");
    expect(stillFind?.status).not.toBe("fixed");
  });

  afterAll(async () => {
    if (ownerId) await db.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (attackerId) await db.user.delete({ where: { id: attackerId } }).catch(() => {});
  });
});
