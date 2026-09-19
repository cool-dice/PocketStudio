import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { flushRagQueue, indexFileContent } from "@/lib/rag/hooks";
import { retrieve } from "@/lib/rag/retrieve";
import { ragScopeFromThread } from "@/lib/rag/scope";
import {
  checkpointProject,
  initProjectGit,
  listProjectCommits,
  projectRoot,
  removeProjectDir,
  writeWorkspaceFile,
} from "@/lib/workspace";

import { POST as restoreCheckpoint } from "../../app/api/projects/[id]/restore/route";
import { POST as searchCanon } from "../../app/api/rag/search/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const goneRel = "src/restore-gone.ts";
const keepRel = "src/keep.ts";
const goneMarker = `unique-restore-gone-${stamp}-lighthouse`;
const alphaMarker = `unique-restore-alpha-${stamp}-harbor`;
const betaMarker = `unique-restore-beta-${stamp}-harbor`;

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

describe.skipIf(SKIP_PG)("git restore reindexes file RAG", () => {
  let ownerId: string | null = null;
  let projectId: string | null = null;

  test("restore drops deleted paths from retrieve/search and refreshes leftovers", async () => {
    const owner = await db.user.create({
      data: {
        name: "RestoreRag",
        email: `restore-rag-${stamp}@example.test`,
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

    const project = await db.project.create({
      data: { userId: owner.id, name: "coder", type: "app" },
    });
    projectId = project.id;
    const root = projectRoot(project.id);

    await writeWorkspaceFile(
      root,
      keepRel,
      `export const keep = "${alphaMarker}";\n`,
    );
    await initProjectGit(root, `keep-${stamp}`);
    const first = (await listProjectCommits(root, 1))[0];
    expect(first).toBeTruthy();

    await writeWorkspaceFile(
      root,
      keepRel,
      `export const keep = "${betaMarker}";\n`,
    );
    await writeWorkspaceFile(
      root,
      goneRel,
      `export const beacon = "${goneMarker}";\n`,
    );
    const second = await checkpointProject(root, `gone-${stamp}`);
    expect(second.noop).toBe(false);
    await indexFileContent(db, {
      userId: owner.id,
      projectId: project.id,
      relPath: keepRel,
      content: `export const keep = "${betaMarker}";\n`,
    });
    await indexFileContent(db, {
      userId: owner.id,
      projectId: project.id,
      relPath: goneRel,
      content: `export const beacon = "${goneMarker}";\n`,
    });

    const scope = ragScopeFromThread(owner.id, project.id);
    const beforeGone = await retrieve(db, { scope, query: goneMarker, limit: 8 });
    expect(beforeGone.hits.some((h) => h.path === goneRel)).toBe(true);
    const beforeBeta = await retrieve(db, { scope, query: betaMarker, limit: 8 });
    expect(beforeBeta.hits.some((h) => h.path === keepRel)).toBe(true);

    const restored = await restoreCheckpoint(
      jsonRequest(
        `http://localhost/api/projects/${project.id}/restore`,
        "POST",
        { commit: first!.hash },
        token,
      ),
      { params: Promise.resolve({ id: project.id }) },
    );
    expect(restored.status).toBe(200);
    await flushRagQueue();

    const afterGone = await retrieve(db, { scope, query: goneMarker, limit: 8 });
    expect(afterGone.hits.some((h) => h.path === goneRel)).toBe(false);
    expect(afterGone.hits.some((h) => h.excerpt.includes(goneMarker))).toBe(false);

    const leftover = await db.ragChunk.count({
      where: {
        userId: owner.id,
        projectId: project.id,
        sourceType: "file",
        path: goneRel,
      },
    });
    expect(leftover).toBe(0);

    const afterAlpha = await retrieve(db, { scope, query: alphaMarker, limit: 8 });
    const keepHit = afterAlpha.hits.find((h) => h.path === keepRel);
    expect(keepHit).toBeTruthy();
    expect(keepHit!.excerpt).toContain(alphaMarker);
    expect(keepHit!.excerpt).not.toContain(betaMarker);

    const searched = await searchCanon(
      jsonRequest(
        "http://localhost/api/rag/search",
        "POST",
        {
          query: goneMarker,
          threadProjectId: project.id,
          kinds: ["file"],
          limit: 8,
        },
        token,
      ),
    );
    expect(searched.status).toBe(200);
    const searchJson = (await searched.json()) as {
      hits: { path: string | null; excerpt: string }[];
    };
    expect(searchJson.hits.some((h) => h.path === goneRel)).toBe(false);
    expect(searchJson.hits.some((h) => h.excerpt.includes(goneMarker))).toBe(false);
  });

  afterAll(async () => {
    if (projectId) await removeProjectDir(projectId).catch(() => {});
    if (ownerId) await db.user.delete({ where: { id: ownerId } }).catch(() => {});
  });
});
