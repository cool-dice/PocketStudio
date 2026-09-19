import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import path from "node:path";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  ALBUM_ALREADY_HERE,
  ALBUM_SOURCE_NOT_IMAGE,
} from "@/lib/album-copy";

import { GET as listLibrary } from "./route";
import { PATCH as patchArtifact, DELETE as deleteArtifact } from "./[id]/route";
import {
  GET as listWorkspaceArtifacts,
  POST as postWorkspaceArtifact,
} from "../workspaces/[id]/artifacts/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const GEN_DIR = path.join(process.cwd(), "public", "gen");
const ids: string[] = [];
const files: string[] = [];

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

function writeGenPng(label: string): string {
  mkdirSync(GEN_DIR, { recursive: true });
  const name = `album-${label}-${stamp}.png`;
  const abs = path.join(GEN_DIR, name);
  writeFileSync(abs, Buffer.from([1, 2, 3, 4, 5]));
  files.push(abs);
  return `/gen/${name}`;
}

describe.skipIf(SKIP_PG)("album artifacts: persist, empty vs error, IDOR", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
    for (const file of files) {
      rmSync(file, { force: true });
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `album-${label}-${stamp}@example.test`,
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
    const ws = await db.project.create({
      data: {
        userId: user.id,
        name: `Книга ${label}`,
        type: "book",
        origin: "workspace",
      },
    });
    return { user, token, ws };
  }

  test("empty workspace lists []; missing workspace is 404 not an empty album", async () => {
    const { token, ws } = await seedUser("empty");
    const listed = await listWorkspaceArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(listed.status).toBe(200);
    const json = (await listed.json()) as { artifacts: unknown[] };
    expect(json.artifacts).toEqual([]);

    const missing = await listWorkspaceArtifacts(
      jsonRequest(
        "http://localhost/api/workspaces/does-not-exist/artifacts",
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: "does-not-exist" }) },
    );
    expect(missing.status).toBe(404);
    const missJson = (await missing.json()) as {
      error: string;
      artifacts?: unknown;
    };
    expect(missJson.artifacts).toBeUndefined();
    expect(missJson.error).toMatch(/не найден/i);
  });

  test("image + favorite + library copy persist; missing file is not a clickable url", async () => {
    const { token, ws } = await seedUser("persist");
    const other = await db.project.create({
      data: {
        userId: (await db.project.findUniqueOrThrow({ where: { id: ws.id } }))
          .userId,
        name: "Другая полка",
        type: "book",
        origin: "workspace",
      },
    });
    const liveUrl = writeGenPng("live");
    const source = await db.artifact.create({
      data: {
        projectId: other.id,
        type: "image",
        title: "Маяк в метель",
        prompt: "маяк",
        url: liveUrl,
        meta: JSON.stringify({ albumKind: "illustration" }),
      },
    });

    const copied = await postWorkspaceArtifact(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "POST",
        { sourceId: source.id },
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(copied.status).toBe(201);
    const copiedJson = (await copied.json()) as {
      artifact: {
        id: string;
        title: string;
        url: string | null;
        fileMissing?: boolean;
        projectId: string;
        favorite: boolean;
      };
    };
    expect(copiedJson.artifact.title).toBe("Маяк в метель");
    expect(copiedJson.artifact.projectId).toBe(ws.id);
    expect(copiedJson.artifact.id).not.toBe(source.id);
    expect(copiedJson.artifact.url).toMatch(/^\/gen\//);
    expect(copiedJson.artifact.url).not.toBe(liveUrl);
    expect(copiedJson.artifact.fileMissing).toBe(false);
    if (copiedJson.artifact.url) {
      files.push(path.join(process.cwd(), "public", copiedJson.artifact.url.slice(1)));
    }
    expect(existsSync(path.join(GEN_DIR, path.basename(liveUrl)))).toBe(true);

    const fav = await patchArtifact(
      jsonRequest(
        `http://localhost/api/artifacts/${copiedJson.artifact.id}`,
        "PATCH",
        { favorite: true },
        token,
      ),
      { params: Promise.resolve({ id: copiedJson.artifact.id }) },
    );
    expect(fav.status).toBe(200);

    const reload = await listWorkspaceArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(reload.status).toBe(200);
    const reloadJson = (await reload.json()) as {
      artifacts: Array<{ id: string; favorite: boolean; title: string }>;
    };
    const row = reloadJson.artifacts.find((a) => a.id === copiedJson.artifact.id);
    expect(row?.favorite).toBe(true);
    expect(row?.title).toBe("Маяк в метель");

    const goneName = `album-missing-${stamp}.png`;
    const goneUrl = `/gen/${goneName}`;
    const missingRow = await db.artifact.create({
      data: {
        projectId: ws.id,
        type: "image",
        title: "Пропавший кадр",
        url: goneUrl,
        meta: JSON.stringify({ albumKind: "concept" }),
      },
    });
    const listedMissing = await listWorkspaceArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    const missingJson = (await listedMissing.json()) as {
      artifacts: Array<{
        id: string;
        url: string | null;
        fileMissing?: boolean;
      }>;
    };
    const missingArt = missingJson.artifacts.find((a) => a.id === missingRow.id);
    expect(missingArt?.url).toBe(null);
    expect(missingArt?.fileMissing).toBe(true);
    expect(JSON.stringify(missingArt)).not.toContain(goneUrl);

    const library = await listLibrary(
      jsonRequest("http://localhost/api/artifacts", "GET", undefined, token),
    );
    expect(library.status).toBe(200);
    const libJson = (await library.json()) as {
      artifacts: Array<{ id: string; url: string | null; fileMissing?: boolean }>;
    };
    const libMissing = libJson.artifacts.find((a) => a.id === missingRow.id);
    expect(libMissing?.url).toBe(null);
    expect(libMissing?.fileMissing).toBe(true);

    const sameWs = await postWorkspaceArtifact(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "POST",
        { sourceId: copiedJson.artifact.id },
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(sameWs.status).toBe(409);
    const sameJson = (await sameWs.json()) as { error: string; artifact?: unknown };
    expect(sameJson.artifact).toBeUndefined();
    expect(sameJson.error).toBe(ALBUM_ALREADY_HERE);

    const track = await db.artifact.create({
      data: { projectId: other.id, type: "audio", title: "Голос" },
    });
    const notImage = await postWorkspaceArtifact(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "POST",
        { sourceId: track.id },
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(notImage.status).toBe(400);
    const notImageJson = (await notImage.json()) as { error: string };
    expect(notImageJson.error).toBe(ALBUM_SOURCE_NOT_IMAGE);

    const deleted = await deleteArtifact(
      jsonRequest(
        `http://localhost/api/artifacts/${copiedJson.artifact.id}`,
        "DELETE",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: copiedJson.artifact.id }) },
    );
    expect(deleted.status).toBe(200);
    const afterDel = await listWorkspaceArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    const afterJson = (await afterDel.json()) as { artifacts: Array<{ id: string }> };
    expect(afterJson.artifacts.some((a) => a.id === copiedJson.artifact.id)).toBe(
      false,
    );
    expect(
      await db.artifact.findUnique({ where: { id: copiedJson.artifact.id } }),
    ).toBe(null);
    expect(await db.artifact.findUnique({ where: { id: source.id } })).not.toBe(null);
  });

  test("other user cannot list, copy, favorite, or delete album artifacts", async () => {
    const owner = await seedUser("owner");
    const attacker = await seedUser("atk");
    const url = writeGenPng("idor");
    const artifact = await db.artifact.create({
      data: {
        projectId: owner.ws.id,
        type: "image",
        title: "Секретный кадр",
        url,
      },
    });

    const stolenList = await listWorkspaceArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${owner.ws.id}/artifacts`,
        "GET",
        undefined,
        attacker.token,
      ),
      { params: Promise.resolve({ id: owner.ws.id }) },
    );
    expect(stolenList.status).toBe(404);
    const stolenListJson = (await stolenList.json()) as { artifacts?: unknown };
    expect(stolenListJson.artifacts).toBeUndefined();

    const stolenCopy = await postWorkspaceArtifact(
      jsonRequest(
        `http://localhost/api/workspaces/${attacker.ws.id}/artifacts`,
        "POST",
        { sourceId: artifact.id },
        attacker.token,
      ),
      { params: Promise.resolve({ id: attacker.ws.id }) },
    );
    expect(stolenCopy.status).toBe(404);
    const stolenCopyJson = (await stolenCopy.json()) as { artifact?: unknown };
    expect(stolenCopyJson.artifact).toBeUndefined();

    const stolenPatch = await patchArtifact(
      jsonRequest(
        `http://localhost/api/artifacts/${artifact.id}`,
        "PATCH",
        { favorite: true },
        attacker.token,
      ),
      { params: Promise.resolve({ id: artifact.id }) },
    );
    expect(stolenPatch.status).toBe(404);

    const stolenDel = await deleteArtifact(
      jsonRequest(
        `http://localhost/api/artifacts/${artifact.id}`,
        "DELETE",
        undefined,
        attacker.token,
      ),
      { params: Promise.resolve({ id: artifact.id }) },
    );
    expect(stolenDel.status).toBe(404);

    const still = await db.artifact.findUnique({ where: { id: artifact.id } });
    expect(still?.title).toBe("Секретный кадр");
    expect(still?.favorite).toBe(false);
    expect(
      await db.artifact.count({ where: { projectId: attacker.ws.id } }),
    ).toBe(0);
  });
});
