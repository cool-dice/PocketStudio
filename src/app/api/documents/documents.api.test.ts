import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { indexSectionById } from "@/lib/rag";
import { retrieve } from "@/lib/rag/retrieve";
import { ragScopeFromThread } from "@/lib/rag/scope";

import { GET as getDocument } from "./[id]/route";
import { PATCH as patchSection } from "../sections/[id]/route";
import {
  GET as listRevisions,
  POST as restoreRevision,
} from "../sections/[id]/revisions/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const oldMarker = `old-chapter-${stamp}-lighthouse`;
const newMarker = `new-chapter-${stamp}-harbor`;
let ownerId: string | null = null;

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

describe.skipIf(SKIP_PG)("documents: rollback, history, missing id", () => {
  afterAll(async () => {
    if (ownerId) await db.user.delete({ where: { id: ownerId } }).catch(() => {});
  });

  test("rollback restores text + RAG; history is API rows; missing id is 404", async () => {
    const owner = await db.user.create({
      data: {
        name: "DocOwner",
        email: `doc-roll-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ownerId = owner.id;
    const token = await signSession({
      sub: owner.id,
      email: owner.email,
      name: owner.name,
      role: owner.role,
    });
    const ws = await db.project.create({
      data: { userId: owner.id, name: "Книга rollback", type: "book" },
    });
    const document = await db.document.create({
      data: { projectId: ws.id, title: "Рукопись" },
    });
    const section = await db.documentSection.create({
      data: {
        documentId: document.id,
        title: "гл. 1",
        content: `У маяка ${oldMarker}.`,
      },
    });

    await indexSectionById(db, section.id);

    const patched = await patchSection(
      jsonRequest(
        `http://localhost/api/sections/${section.id}`,
        "PATCH",
        { content: `Новый берег ${newMarker}.` },
        token,
      ),
      { params: Promise.resolve({ id: section.id }) },
    );
    expect(patched.status).toBe(200);

    await indexSectionById(db, section.id);

    const history = await listRevisions(
      jsonRequest(
        `http://localhost/api/sections/${section.id}/revisions`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: section.id }) },
    );
    expect(history.status).toBe(200);
    const histJson = (await history.json()) as {
      revisions: { id: string; preview: string; source: string }[];
    };
    expect(histJson.revisions.length).toBeGreaterThan(0);
    const oldRev = histJson.revisions.find((r) => r.preview.includes(oldMarker));
    expect(oldRev).toBeTruthy();
    expect(oldRev?.source).toBe("manual");
    expect(histJson.revisions.some((r) => r.id.startsWith("fake-"))).toBe(false);

    const restored = await restoreRevision(
      jsonRequest(
        `http://localhost/api/sections/${section.id}/revisions`,
        "POST",
        { revisionId: oldRev!.id },
        token,
      ),
      { params: Promise.resolve({ id: section.id }) },
    );
    expect(restored.status).toBe(200);
    const restoredJson = (await restored.json()) as {
      section: { content: string };
    };
    expect(restoredJson.section.content).toContain(oldMarker);
    expect(restoredJson.section.content).not.toContain(newMarker);

    const live = await db.documentSection.findUnique({ where: { id: section.id } });
    expect(live?.content).toContain(oldMarker);

    const hits = await retrieve(db, {
      scope: ragScopeFromThread(owner.id, ws.id),
      query: oldMarker,
      limit: 8,
    });
    expect(hits.hits.some((h) => h.excerpt.includes(oldMarker))).toBe(true);
    expect(hits.hits.some((h) => h.excerpt.includes(newMarker))).toBe(false);

    const missing = await getDocument(
      jsonRequest(
        "http://localhost/api/documents/cmissingdocid01",
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: "cmissingdocid01" }) },
    );
    expect(missing.status).toBe(404);
    const missingJson = (await missing.json()) as {
      error: string;
      document?: unknown;
    };
    expect(missingJson.document).toBeUndefined();
    expect(missingJson.error).toMatch(/не найден/i);

    const junk = await getDocument(
      jsonRequest("http://localhost/api/documents/..%2Fetc", "GET", undefined, token),
      { params: Promise.resolve({ id: "../etc" }) },
    );
    expect(junk.status).toBe(404);

    const owned = await getDocument(
      jsonRequest(
        `http://localhost/api/documents/${document.id}`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: document.id }) },
    );
    expect(owned.status).toBe(200);
    const ownedJson = (await owned.json()) as { document: { id: string } };
    expect(ownedJson.document.id).toBe(document.id);
  });
});
