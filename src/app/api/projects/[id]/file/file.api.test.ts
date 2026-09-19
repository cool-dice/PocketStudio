import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { indexFileContent } from "@/lib/rag/hooks";
import { retrieve } from "@/lib/rag/retrieve";
import { ragScopeFromThread } from "@/lib/rag/scope";
import { removeProjectDir } from "@/lib/workspace";

import { DELETE as deleteFile, PUT as putFile } from "./route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const marker = `unique-rag-file-${stamp}-lighthouse`;

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

describe.skipIf(SKIP_PG)("DELETE /api/projects/[id]/file purges RAG", () => {
  let ownerId: string | null = null;
  let attackerId: string | null = null;
  let projectId: string | null = null;

  test("owned delete removes the path from retrieve; IDOR is 404", async () => {
    const owner = await db.user.create({
      data: {
        name: "FileOwner",
        email: `file-owner-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ownerId = owner.id;
    const ownerToken = await signSession({
      sub: owner.id,
      email: owner.email,
      name: owner.name,
      role: owner.role,
    });
    const attacker = await db.user.create({
      data: {
        name: "FileAtk",
        email: `file-atk-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    attackerId = attacker.id;
    const attackerToken = await signSession({
      sub: attacker.id,
      email: attacker.email,
      name: attacker.name,
      role: attacker.role,
    });

    const project = await db.project.create({
      data: { userId: owner.id, name: "coder", type: "app" },
    });
    projectId = project.id;
    const rel = "src/beacon.ts";

    const put = await putFile(
      jsonRequest(
        `http://localhost/api/projects/${project.id}/file`,
        "PUT",
        { path: rel, content: `export const hint = "${marker}";\n` },
        ownerToken,
      ),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(put.status).toBe(200);

    await indexFileContent(db, {
      userId: owner.id,
      projectId: project.id,
      relPath: rel,
      content: `export const hint = "${marker}";\n`,
    });

    const before = await retrieve(db, {
      scope: ragScopeFromThread(owner.id, project.id),
      query: marker,
      limit: 8,
    });
    expect(before.hits.some((h) => h.path === rel)).toBe(true);

    const stolen = await deleteFile(
      jsonRequest(
        `http://localhost/api/projects/${project.id}/file?path=${encodeURIComponent(rel)}`,
        "DELETE",
        undefined,
        attackerToken,
      ),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(stolen.status).toBe(404);

    const del = await deleteFile(
      jsonRequest(
        `http://localhost/api/projects/${project.id}/file?path=${encodeURIComponent(rel)}`,
        "DELETE",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(del.status).toBe(200);
    const delJson = (await del.json()) as { deleted: boolean; path: string };
    expect(delJson.deleted).toBe(true);
    expect(delJson.path).toBe(rel);

    const after = await retrieve(db, {
      scope: ragScopeFromThread(owner.id, project.id),
      query: marker,
      limit: 8,
    });
    expect(after.hits.some((h) => h.path === rel)).toBe(false);
    expect(after.hits.some((h) => h.excerpt.includes(marker))).toBe(false);

    const leftover = await db.ragChunk.count({
      where: {
        userId: owner.id,
        projectId: project.id,
        sourceType: "file",
        path: rel,
      },
    });
    expect(leftover).toBe(0);
  });

  afterAll(async () => {
    if (projectId) await removeProjectDir(projectId).catch(() => {});
    if (ownerId) await db.user.delete({ where: { id: ownerId } }).catch(() => {});
    if (attackerId) await db.user.delete({ where: { id: attackerId } }).catch(() => {});
  });
});
