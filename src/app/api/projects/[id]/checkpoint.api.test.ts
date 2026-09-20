import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  initProjectGit,
  listProjectCommits,
  projectRoot,
  readWorkspaceFile,
  removeProjectDir,
  writeWorkspaceFile,
} from "@/lib/workspace";
import { PREVIEW_HTML_HINT, PREVIEW_LISTING_HINT } from "@/lib/studio-copy";

import { POST as createCheckpoint } from "./checkpoint/route";
import { GET as listCommits } from "./commits/route";
import { GET as exportZip } from "./export/route";
import { GET as preview } from "./preview/route";
import { POST as restoreCheckpoint } from "./restore/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];
const projectIds: string[] = [];

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

describe.skipIf(SKIP_PG)("project checkpoints / zip / preview isolation", () => {
  afterAll(async () => {
    for (const id of projectIds) {
      await removeProjectDir(id).catch(() => {});
    }
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("list/create/restore and zip stay on THIS project; preview is static", async () => {
    const owner = await db.user.create({
      data: {
        name: "CodeOwner",
        email: `cp-owner-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(owner.id);
    const attacker = await db.user.create({
      data: {
        name: "CodeAtk",
        email: `cp-atk-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(attacker.id);
    const ownerToken = await signSession({
      sub: owner.id,
      email: owner.email,
      name: owner.name,
      role: owner.role,
    });
    const attackerToken = await signSession({
      sub: attacker.id,
      email: attacker.email,
      name: attacker.name,
      role: attacker.role,
    });

    const projectA = await db.project.create({
      data: { userId: owner.id, name: "App A", type: "app" },
    });
    const projectB = await db.project.create({
      data: { userId: owner.id, name: "App B", type: "app" },
    });
    projectIds.push(projectA.id, projectB.id);

    await writeWorkspaceFile(
      projectRoot(projectA.id),
      "src/a.ts",
      `export const mark = "alpha-${stamp}";\n`,
    );
    await initProjectGit(projectRoot(projectA.id), `A0-${stamp}`);
    const firstA = (await listProjectCommits(projectRoot(projectA.id), 1))[0]!;

    await writeWorkspaceFile(
      projectRoot(projectA.id),
      "src/a.ts",
      `export const mark = "beta-${stamp}";\n`,
    );
    const created = await createCheckpoint(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/checkpoint`,
        "POST",
        { message: `A1-${stamp}` },
        ownerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(created.status).toBe(200);

    await writeWorkspaceFile(
      projectRoot(projectB.id),
      "src/b.ts",
      `export const mark = "foreign-${stamp}";\n`,
    );
    await initProjectGit(projectRoot(projectB.id), `B-unique-${stamp}`);
    const firstB = (await listProjectCommits(projectRoot(projectB.id), 1))[0]!;

    const listedA = await listCommits(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/commits`,
        "GET",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(listedA.status).toBe(200);
    const listedJson = (await listedA.json()) as {
      commits: { hash: string; message: string }[];
    };
    expect(listedJson.commits.some((c) => c.message === `A1-${stamp}`)).toBe(true);
    expect(listedJson.commits.some((c) => c.message.includes(`B-unique-${stamp}`))).toBe(
      false,
    );

    const stolenList = await listCommits(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/commits`,
        "GET",
        undefined,
        attackerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(stolenList.status).toBe(404);

    const stolenCreate = await createCheckpoint(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/checkpoint`,
        "POST",
        { message: "взлом" },
        attackerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(stolenCreate.status).toBe(404);

    const cross = await restoreCheckpoint(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/restore`,
        "POST",
        { commit: firstB.hash },
        ownerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(cross.status).toBe(404);

    const stolenRestore = await restoreCheckpoint(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/restore`,
        "POST",
        { commit: firstA.hash },
        attackerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(stolenRestore.status).toBe(404);

    const restored = await restoreCheckpoint(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/restore`,
        "POST",
        { commit: firstA.hash },
        ownerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(restored.status).toBe(200);
    const file = await readWorkspaceFile(projectRoot(projectA.id), "src/a.ts");
    expect(file.content).toContain(`alpha-${stamp}`);
    expect(file.content).not.toContain(`beta-${stamp}`);

    const stolenZip = await exportZip(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/export`,
        "GET",
        undefined,
        attackerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(stolenZip.status).toBe(404);

    const zip = await exportZip(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/export`,
        "GET",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(zip.status).toBe(200);
    expect(zip.headers.get("content-type")).toMatch(/zip/);

    await writeWorkspaceFile(
      projectRoot(projectA.id),
      "index.html",
      "<html><body><h1>static</h1></body></html>",
    );
    const htmlPreview = await preview(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/preview`,
        "GET",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(htmlPreview.status).toBe(200);
    const htmlJson = (await htmlPreview.json()) as {
      kind: string;
      running?: boolean;
      hint?: string;
    };
    expect(htmlJson.running).toBe(false);
    expect(htmlJson.kind).toBe("html");
    expect(htmlJson.hint).toBe(PREVIEW_HTML_HINT);

    const stolenPreview = await preview(
      jsonRequest(
        `http://localhost/api/projects/${projectA.id}/preview`,
        "GET",
        undefined,
        attackerToken,
      ),
      { params: Promise.resolve({ id: projectA.id }) },
    );
    expect(stolenPreview.status).toBe(404);

    const listingB = await preview(
      jsonRequest(
        `http://localhost/api/projects/${projectB.id}/preview`,
        "GET",
        undefined,
        ownerToken,
      ),
      { params: Promise.resolve({ id: projectB.id }) },
    );
    expect(listingB.status).toBe(200);
    const listingJson = (await listingB.json()) as {
      kind: string;
      running?: boolean;
      hint?: string;
    };
    expect(listingJson.running).toBe(false);
    expect(listingJson.kind).toBe("listing");
    expect(listingJson.hint).toBe(PREVIEW_LISTING_HINT);
  });
});
