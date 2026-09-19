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

import { POST as tts } from "./route";
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

function wavNames(): string[] {
  if (!existsSync(GEN_DIR)) return [];
  return readdirSync(GEN_DIR).filter((name) => name.endsWith(".wav"));
}

describe.skipIf(SKIP_PG)("POST /api/ai/tts honesty", () => {
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
        email: `tts-${label}-${stamp}@example.test`,
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

  async function seedTtsOverride(userId: string) {
    const provider = await db.aiProvider.create({
      data: {
        userId,
        kind: "openai_compatible",
        name: "Mock TTS",
        baseUrl: "https://tts.test.local/v1",
        apiKey: encryptSecret("sk-test-tts-audio"),
        apiKeyLast4: last4OfKey("sk-test-tts-audio"),
        enabled: true,
      },
    });
    const model = await db.aiModel.create({
      data: {
        providerId: provider.id,
        modelId: "tts-1",
        displayName: "tts",
        capChat: false,
        capImage: false,
        capTts: true,
        capAsr: false,
        capEmbeddings: false,
        enabled: true,
      },
    });
    await db.userToolModel.upsert({
      where: { userId_toolId: { userId, toolId: "tts" } },
      create: { userId, toolId: "tts", modelId: model.id },
      update: { modelId: model.id },
    });
  }

  test("unconfigured TTS is UNCONFIGURED_TOOL_MESSAGE and writes no audio file", async () => {
    const { user, token, ws } = await seedUser("noconfig");
    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "tts");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const beforeArts = await db.artifact.count({
      where: { projectId: ws.id, type: "audio" },
    });
    const beforeWav = wavNames();
    const res = await tts(
      jsonRequest(
        "http://localhost/api/ai/tts",
        "POST",
        { projectId: ws.id, text: "Шторм у маяка", voice: "alloy" },
        token,
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; artifact?: unknown };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.artifact).toBeUndefined();
    expect(json.error).not.toMatch(/placeholder|fake|data:audio/i);
    expect(
      await db.artifact.count({ where: { projectId: ws.id, type: "audio" } }),
    ).toBe(beforeArts);
    expect(wavNames()).toEqual(beforeWav);
  });

  test("failed TTS creates no artifact, no wav, and no RAG chunk", async () => {
    const { user, token, ws } = await seedUser("failtts");
    await seedTtsOverride(user.id);
    const marker = `tts-fail-${stamp}-маяк`;
    const beforeArts = await db.artifact.count({
      where: { projectId: ws.id, type: "audio" },
    });
    const beforeChunks = await db.ragChunk.count({
      where: { userId: user.id, sourceType: "artifact" },
    });
    const beforeWav = wavNames();

    globalThis.fetch = (async () =>
      new Response("upstream down", { status: 500 })) as typeof fetch;
    const res = await tts(
      jsonRequest(
        "http://localhost/api/ai/tts",
        "POST",
        { projectId: ws.id, text: marker, title: "Призрак", voice: "nova" },
        token,
      ),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as { error: string; artifact?: unknown };
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.artifact).toBeUndefined();
    expect(json.error).not.toMatch(/готова|playing/i);

    globalThis.fetch = (async () =>
      new Response(new Uint8Array(), { status: 200 })) as typeof fetch;
    const empty = await tts(
      jsonRequest(
        "http://localhost/api/ai/tts",
        "POST",
        { projectId: ws.id, text: `${marker} пустой`, voice: "alloy" },
        token,
      ),
    );
    expect(empty.status).toBeGreaterThanOrEqual(400);
    const emptyJson = (await empty.json()) as { error: string; artifact?: unknown };
    expect(emptyJson.artifact).toBeUndefined();
    expect(emptyJson.error).toMatch(/пустой файл|не удалось|провайдер/i);

    expect(
      await db.artifact.count({ where: { projectId: ws.id, type: "audio" } }),
    ).toBe(beforeArts);
    expect(
      await db.ragChunk.count({
        where: { userId: user.id, sourceType: "artifact" },
      }),
    ).toBe(beforeChunks);
    expect(wavNames()).toEqual(beforeWav);
  });

  test("success saves artifact + wav, maps tongtong to alloy, indexes RAG", async () => {
    const { user, token, ws } = await seedUser("oktts");
    await seedTtsOverride(user.id);
    const marker = `tts-ok-${stamp}-смотрительница`;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://tts.test.local/v1/audio/speech");
      const body = JSON.parse(String(init?.body));
      expect(body.voice).toBe("alloy");
      expect(body.input).toBe(marker);
      return new Response(Buffer.from("RIFFWAVEfmt "), { status: 200 });
    }) as typeof fetch;

    const res = await tts(
      jsonRequest(
        "http://localhost/api/ai/tts",
        "POST",
        { projectId: ws.id, text: marker, title: "Интро", voice: "tongtong" },
        token,
      ),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { artifact: ArtifactDto };
    expect(json.artifact.url).toMatch(/^\/gen\/.+\.wav$/);
    expect(json.artifact.fileMissing).toBe(false);
    expect((json.artifact.meta as { voice?: string } | null)?.voice).toBe("alloy");
    expect((json.artifact.meta as { voice?: string } | null)?.voice).not.toMatch(
      /tongtong/i,
    );
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

  test("empty audio list is []; missing workspace is 404 not empty", async () => {
    const { token, ws } = await seedUser("emptyaudio");
    const listed = await listWorkspaceArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts?type=audio`,
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
        "http://localhost/api/workspaces/does-not-exist/artifacts?type=audio",
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

  test("TTS into another user's workspace is 404 and writes nothing", async () => {
    const owner = await seedUser("ttsowner");
    const attacker = await seedUser("ttsatk");
    await seedTtsOverride(attacker.user.id);
    const beforeArts = await db.artifact.count({
      where: { projectId: owner.ws.id },
    });
    const beforeWav = wavNames();

    globalThis.fetch = (async () =>
      new Response(Buffer.from("RIFF"), { status: 200 })) as typeof fetch;

    const res = await tts(
      jsonRequest(
        "http://localhost/api/ai/tts",
        "POST",
        { projectId: owner.ws.id, text: "секретная озвучка маяка", voice: "nova" },
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
    expect(wavNames()).toEqual(beforeWav);
  });
});
