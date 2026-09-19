import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as getWorkspace } from "./workspaces/[id]/route";
import { GET as getNote } from "./notes/[id]/route";
import { POST as searchRag } from "./rag/search/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

function jsonRequest(url: string, body: unknown, bearer?: string): Request {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("IDOR: other user's ids are 404", () => {
  let ownerId: string | null = null;
  let attackerId: string | null = null;
  let attackerToken: string | null = null;

  test("workspace, note, and rag search do not leak another user", async () => {
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

    const ws = await db.project.create({
      data: { userId: owner.id, name: "Секрет", type: "book" },
    });
    const note = await db.note.create({
      data: { userId: owner.id, rawText: "секретная заметка владельца" },
    });

    const wsRes = await getWorkspace(jsonRequest(`http://localhost/api/workspaces/${ws.id}`, undefined, attackerToken), {
      params: Promise.resolve({ id: ws.id }),
    });
    expect(wsRes.status).toBe(404);
    const wsJson = (await wsRes.json()) as { error: string; workspace?: unknown };
    expect(wsJson.workspace).toBeUndefined();
    expect(wsJson.error).toMatch(/не найден/i);

    const noteRes = await getNote(
      jsonRequest(`http://localhost/api/notes/${note.id}`, undefined, attackerToken),
      { params: Promise.resolve({ id: note.id }) },
    );
    expect(noteRes.status).toBe(404);
    const noteJson = (await noteRes.json()) as { note?: unknown };
    expect(noteJson.note).toBeUndefined();

    const rag = await searchRag(
      jsonRequest(
        "http://localhost/api/rag/search",
        { query: "секретная", threadProjectId: ws.id },
        attackerToken,
      ),
    );
    expect(rag.status).toBe(404);
  });

  afterAll(async () => {
    if (ownerId) await db.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (attackerId) await db.user.delete({ where: { id: attackerId } }).catch(() => {});
  });
});
