import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

import { hashPassword, signSession } from "@/lib/auth";
import { encryptSecret, last4OfKey } from "@/lib/ai/crypto";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { db } from "@/lib/db";
import { flushRagQueue, indexArtifactById } from "@/lib/rag/hooks";
import { retrieve } from "@/lib/rag/retrieve";
import { ragScopeFromThread } from "@/lib/rag/scope";
import type { ArtifactDto } from "@/lib/workspace-types";

import { POST as generateImage } from "./route";
import { GET as listWorkspaceArtifacts } from "../../workspaces/[id]/artifacts/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const GEN_DIR = path.join(process.cwd(), "public", "gen");
const ids: string[] = [];
const files: string[] = [];
const originalFetch = globalThis.fetch;

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

function pngNames(): string[] {
  if (!existsSync(GEN_DIR)) return [];
  return readdirSync(GEN_DIR).filter((name) => name.endsWith(".png"));
}

function imageJson(b64: string): Response {
  return new Response(JSON.stringify({ data: [{ b64_json: b64 }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe.skipIf(SKIP_PG)("POST /api/ai/image honesty", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

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
        email: `img-${label}-${stamp}@example.test`,
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
      data: { userId: user.id, name: `Книга ${label}`, type: "book" },
    });
    return { user, token, ws };
  }

  async function seedImageOverride(userId: string) {
    const provider = await db.aiProvider.create({
      data: {
        userId,
        kind: "openai_compatible",
        name: "Mock Image",
        baseUrl: "https://image.test.local/v1",
        apiKey: encryptSecret("sk-test-image-gen"),
        apiKeyLast4: last4OfKey("sk-test-image-gen"),
        enabled: true,
      },
    });
    const model = await db.aiModel.create({
      data: {
        providerId: provider.id,
        modelId: "dall-e-3",
        displayName: "dall-e",
        capChat: false,
        capImage: true,
        capTts: false,
        capAsr: false,
        capEmbeddings: false,
        enabled: true,
      },
    });
    await db.userToolModel.upsert({
      where: { userId_toolId: { userId, toolId: "image" } },
      create: { userId, toolId: "image", modelId: model.id },
      update: { modelId: model.id },
    });
  }

  test("unconfigured image is UNCONFIGURED_TOOL_MESSAGE and writes no png", async () => {
    const { user, token, ws } = await seedUser("noconfig");
    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "image");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const beforeArts = await db.artifact.count({
      where: { projectId: ws.id, type: "image" },
    });
    const beforePng = pngNames();
    const res = await generateImage(
      jsonRequest(
        "http://localhost/api/ai/image",
        "POST",
        { projectId: ws.id, prompt: "Шторм у маяка ночью" },
        token,
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; artifact?: unknown };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.artifact).toBeUndefined();
    expect(json.error).not.toMatch(/placeholder|fake|data:image/i);
    expect(
      await db.artifact.count({ where: { projectId: ws.id, type: "image" } }),
    ).toBe(beforeArts);
    expect(pngNames()).toEqual(beforePng);
  });

  test("failed generation creates no artifact, no png, and no RAG chunk", async () => {
    const { user, token, ws } = await seedUser("failimg");
    await seedImageOverride(user.id);
    const marker = `img-fail-${stamp}-маяк`;
    const beforeArts = await db.artifact.count({
      where: { projectId: ws.id, type: "image" },
    });
    const beforeChunks = await db.ragChunk.count({
      where: { userId: user.id, sourceType: "artifact" },
    });
    const beforePng = pngNames();

    globalThis.fetch = (async () =>
      new Response("upstream down", { status: 500 })) as typeof fetch;
    const res = await generateImage(
      jsonRequest(
        "http://localhost/api/ai/image",
        "POST",
        { projectId: ws.id, prompt: marker, title: "Призрак" },
        token,
      ),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as { error: string; artifact?: unknown };
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.artifact).toBeUndefined();
    expect(json.error).not.toMatch(/готова|placeholder|data:image/i);

    globalThis.fetch = (async () => imageJson("")) as typeof fetch;
    const empty = await generateImage(
      jsonRequest(
        "http://localhost/api/ai/image",
        "POST",
        { projectId: ws.id, prompt: `${marker} пустой` },
        token,
      ),
    );
    expect(empty.status).toBeGreaterThanOrEqual(400);
    const emptyJson = (await empty.json()) as { error: string; artifact?: unknown };
    expect(emptyJson.artifact).toBeUndefined();
    expect(emptyJson.error).toMatch(/пустой файл|не удалось|провайдер/i);

    expect(
      await db.artifact.count({ where: { projectId: ws.id, type: "image" } }),
    ).toBe(beforeArts);
    expect(
      await db.ragChunk.count({
        where: { userId: user.id, sourceType: "artifact" },
      }),
    ).toBe(beforeChunks);
    expect(pngNames()).toEqual(beforePng);
  });

  test("success saves artifact + png and indexes RAG", async () => {
    const { user, token, ws } = await seedUser("okimg");
    await seedImageOverride(user.id);
    const marker = `img-ok-${stamp}-смотрительница`;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://image.test.local/v1/images/generations");
      return imageJson(Buffer.from("PNGIMG").toString("base64"));
    }) as typeof fetch;

    const res = await generateImage(
      jsonRequest(
        "http://localhost/api/ai/image",
        "POST",
        { projectId: ws.id, prompt: marker, title: "Обложка" },
        token,
      ),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { artifact: ArtifactDto };
    expect(json.artifact.url).toMatch(/^\/gen\/.+\.png$/);
    expect(json.artifact.fileMissing).toBe(false);
    expect(json.artifact.url).not.toMatch(/placeholder|data:image/i);
    if (json.artifact.url?.startsWith("/gen/")) {
      files.push(path.join(GEN_DIR, path.basename(json.artifact.url)));
    }
    expect(files.some((f) => existsSync(f))).toBe(true);

    await flushRagQueue();
    await indexArtifactById(db, json.artifact.id);
    const hits = await retrieve(db, {
      scope: ragScopeFromThread(user.id, ws.id),
      query: marker,
      limit: 8,
    });
    expect(hits.hits.some((h) => h.sourceId === json.artifact.id)).toBe(true);
    expect(hits.hits.some((h) => h.excerpt.includes(marker))).toBe(true);
  });

  test("empty image list is []; missing workspace is 404 not empty", async () => {
    const { token, ws } = await seedUser("emptyimg");
    const listed = await listWorkspaceArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts?type=image`,
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
        "http://localhost/api/workspaces/does-not-exist/artifacts?type=image",
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

  test("image into another user's workspace is 404 and writes nothing", async () => {
    const owner = await seedUser("imgowner");
    const attacker = await seedUser("imgatk");
    await seedImageOverride(attacker.user.id);
    const beforeArts = await db.artifact.count({
      where: { projectId: owner.ws.id },
    });
    const beforePng = pngNames();

    globalThis.fetch = (async () =>
      imageJson(Buffer.from("PNGIMG").toString("base64"))) as typeof fetch;

    const res = await generateImage(
      jsonRequest(
        "http://localhost/api/ai/image",
        "POST",
        { projectId: owner.ws.id, prompt: "секретный кадр маяка ночью" },
        attacker.token,
      ),
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string; artifact?: unknown };
    expect(json.artifact).toBeUndefined();
    expect(json.error).toMatch(/не найден/i);
    expect(
      await db.artifact.count({ where: { projectId: owner.ws.id } }),
    ).toBe(beforeArts);
    expect(pngNames()).toEqual(beforePng);
  });
});
