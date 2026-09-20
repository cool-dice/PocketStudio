import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { encryptSecret, last4OfKey } from "@/lib/ai/crypto";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE, type AiToolId } from "@/lib/ai/tools";
import { db } from "@/lib/db";
import { paletteFromArtifact } from "@/lib/palette";
import type { ArtifactDto, EntityDto } from "@/lib/workspace-types";

import { POST as generatePalette } from "./palette/route";
import { POST as describeEntity } from "./describe/route";
import { GET as listArtifacts } from "../workspaces/[id]/artifacts/route";
import { GET as getEntity } from "../entities/[id]/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];
const originalFetch = globalThis.fetch;

const LIVE_PALETTE = {
  kind: "palette" as const,
  mood: "северная сказка",
  colors: [
    { hex: "#2C3E50", name: "Ночь", usage: "фон" },
    { hex: "#7F8C8D", name: "Камень", usage: "вторичный" },
    { hex: "#E74C3C", name: "Костёр", usage: "акцент" },
  ],
  fonts: { heading: "Georgia", body: "Inter", note: "тепло" },
  advice: "Акцент редкий.",
  brief: "сказка",
};

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

function hangFetch(): { fetchCalls: number } {
  const state = { fetchCalls: 0 };
  globalThis.fetch = (async () => {
    state.fetchCalls += 1;
    await new Promise((r) => setTimeout(r, 30_000));
    return new Response("should not hang", { status: 500 });
  }) as typeof fetch;
  return state;
}

describe.skipIf(SKIP_PG)("ai/palette and ai/describe: unconfigured, persist, IDOR", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `paldesc-${label}-${stamp}@example.test`,
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
      data: { userId: user.id, name: `Стиль ${label}`, type: "book" },
    });
    return { user, token, ws };
  }

  async function seedChatOverride(userId: string, toolId: AiToolId) {
    const provider = await db.aiProvider.create({
      data: {
        userId,
        kind: "openai_compatible",
        name: `Mock ${toolId}`,
        baseUrl: `https://${toolId}.test.local/v1`,
        apiKey: encryptSecret(`sk-test-${toolId}`),
        apiKeyLast4: last4OfKey(`sk-test-${toolId}`),
        enabled: true,
      },
    });
    const model = await db.aiModel.create({
      data: {
        providerId: provider.id,
        modelId: "gpt-4o-mini",
        displayName: `${toolId}-llm`,
        capChat: true,
        capImage: false,
        capTts: false,
        capAsr: false,
        capEmbeddings: false,
        enabled: true,
      },
    });
    await db.userToolModel.upsert({
      where: { userId_toolId: { userId, toolId } },
      create: { userId, toolId, modelId: model.id },
      update: { modelId: model.id },
    });
  }

  async function seedPalette(projectId: string) {
    return db.artifact.create({
      data: {
        projectId,
        type: "file",
        title: "Палитра стиля",
        stage: "style",
        prompt: "сказка",
        meta: JSON.stringify(LIVE_PALETTE),
      },
    });
  }

  async function toolUnconfigured(userId: string, toolId: AiToolId) {
    try {
      await resolveToolRoute(db, userId, toolId);
      return false;
    } catch (err) {
      return (
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE
      );
    }
  }

  test("unconfigured palette is 400 UNCONFIGURED, no hang, previous artifact stays", async () => {
    const { user, token, ws } = await seedUser("nopalette");
    if (!(await toolUnconfigured(user.id, "palette"))) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const prior = await seedPalette(ws.id);
    const hang = hangFetch();
    const started = Date.now();
    const res = await generatePalette(
      jsonRequest(
        "http://localhost/api/ai/palette",
        "POST",
        { projectId: ws.id, brief: "холодный триллер" },
        token,
      ),
    );
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(hang.fetchCalls).toBe(0);
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      artifact?: unknown;
      palette?: unknown;
    };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.artifact).toBeUndefined();
    expect(json.palette).toBeUndefined();
    expect(JSON.stringify(json)).not.toMatch(/#2C3E50|#000000|fake/i);
    const still = await db.artifact.findUnique({ where: { id: prior.id } });
    expect(still?.meta).toContain("северная сказка");
    expect(
      await db.artifact.count({ where: { projectId: ws.id, stage: "style" } }),
    ).toBe(1);
  });

  test("unconfigured describe is 400 UNCONFIGURED, no hang, card text stays", async () => {
    const { user, token, ws } = await seedUser("nodesc");
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: "Эйнар",
        description: "смотритель маяка",
      },
    });
    if (!(await toolUnconfigured(user.id, "describe"))) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const hang = hangFetch();
    const started = Date.now();
    const res = await describeEntity(
      jsonRequest(
        "http://localhost/api/ai/describe",
        "POST",
        { entityId: entity.id },
        token,
      ),
    );
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(hang.fetchCalls).toBe(0);
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      description?: unknown;
      entityId?: unknown;
    };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.description).toBeUndefined();
    const live = await db.entity.findUnique({ where: { id: entity.id } });
    expect(live?.description).toBe("смотритель маяка");
  });

  test("failed palette LLM does not wipe the previous style artifact", async () => {
    const { user, token, ws } = await seedUser("failpal");
    await seedChatOverride(user.id, "palette");
    const prior = await seedPalette(ws.id);
    globalThis.fetch = (async () =>
      new Response("upstream down", { status: 500 })) as typeof fetch;
    const res = await generatePalette(
      jsonRequest(
        "http://localhost/api/ai/palette",
        "POST",
        { projectId: ws.id, brief: "пересобрать" },
        token,
      ),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as { error: string; palette?: unknown };
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.palette).toBeUndefined();
    expect(json.error).not.toBe(UNCONFIGURED_TOOL_MESSAGE);
    const still = await db.artifact.findUnique({ where: { id: prior.id } });
    expect(still?.id).toBe(prior.id);
    expect(still?.meta).toContain("#2C3E50");
    expect(
      await db.artifact.count({ where: { projectId: ws.id, stage: "style" } }),
    ).toBe(1);
  });

  test("failed or empty describe LLM does not wipe the previous card text", async () => {
    const { user, token, ws } = await seedUser("faildesc");
    await seedChatOverride(user.id, "describe");
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: "Марина",
        description: "смотрительница маяка",
      },
    });

    globalThis.fetch = (async () =>
      new Response("upstream down", { status: 500 })) as typeof fetch;
    const failRes = await describeEntity(
      jsonRequest(
        "http://localhost/api/ai/describe",
        "POST",
        { entityId: entity.id },
        token,
      ),
    );
    expect(failRes.status).toBeGreaterThanOrEqual(400);
    const failJson = (await failRes.json()) as { error: string; description?: unknown };
    expect(failJson.error).toMatch(/[А-Яа-яЁё]/);
    expect(failJson.description).toBeUndefined();
    expect(
      (await db.entity.findUnique({ where: { id: entity.id } }))?.description,
    ).toBe("смотрительница маяка");

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: "   " } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    const emptyRes = await describeEntity(
      jsonRequest(
        "http://localhost/api/ai/describe",
        "POST",
        { entityId: entity.id },
        token,
      ),
    );
    expect(emptyRes.status).toBe(502);
    const emptyJson = (await emptyRes.json()) as { error: string; description?: unknown };
    expect(emptyJson.error).toMatch(/пуст/i);
    expect(emptyJson.description).toBeUndefined();
    expect(
      (await db.entity.findUnique({ where: { id: entity.id } }))?.description,
    ).toBe("смотрительница маяка");
  });

  test("persisted palette artifact reloads without fake swatches", async () => {
    const { token, ws } = await seedUser("persistpal");
    await seedPalette(ws.id);

    const list = await listArtifacts(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/artifacts`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { artifacts: ArtifactDto[] };
    const parsed = body.artifacts.map(paletteFromArtifact).find(Boolean);
    expect(parsed?.mood).toBe("северная сказка");
    expect(parsed?.colors).toHaveLength(3);
    expect(parsed?.colors.map((c) => c.hex)).toEqual([
      "#2C3E50",
      "#7F8C8D",
      "#E74C3C",
    ]);
  });

  test("persisted entity description reloads via GET without a fake bio", async () => {
    const { token, ws } = await seedUser("persistdesc");
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: "Эйнар",
        description: "смотритель маяка, живёт у скалы",
      },
    });

    const first = await getEntity(
      jsonRequest(
        `http://localhost/api/entities/${entity.id}`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: entity.id }) },
    );
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { entity: EntityDto };
    expect(firstJson.entity.description).toBe("смотритель маяка, живёт у скалы");

    const reload = await getEntity(
      jsonRequest(
        `http://localhost/api/entities/${entity.id}`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: entity.id }) },
    );
    expect(reload.status).toBe(200);
    const reloadJson = (await reload.json()) as { entity: EntityDto };
    expect(reloadJson.entity.description).toBe(firstJson.entity.description);
  });

  test("palette and describe are 404 for another user's ids", async () => {
    const owner = await seedUser("palowner");
    const attacker = await seedUser("palatk");
    const entity = await db.entity.create({
      data: {
        projectId: owner.ws.id,
        kind: "location",
        name: "Маяк",
        description: "секрет",
      },
    });
    const prior = await seedPalette(owner.ws.id);

    const pal = await generatePalette(
      jsonRequest(
        "http://localhost/api/ai/palette",
        "POST",
        { projectId: owner.ws.id },
        attacker.token,
      ),
    );
    expect(pal.status).toBe(404);
    const palJson = (await pal.json()) as { error: string; palette?: unknown };
    expect(palJson.palette).toBeUndefined();
    expect(palJson.error).toMatch(/не найден/i);
    expect(await db.artifact.findUnique({ where: { id: prior.id } })).toBeTruthy();

    const desc = await describeEntity(
      jsonRequest(
        "http://localhost/api/ai/describe",
        "POST",
        { entityId: entity.id },
        attacker.token,
      ),
    );
    expect(desc.status).toBe(404);
    const descJson = (await desc.json()) as {
      error: string;
      description?: unknown;
    };
    expect(descJson.description).toBeUndefined();
    expect(JSON.stringify(descJson)).not.toContain("секрет");
    expect(
      (await db.entity.findUnique({ where: { id: entity.id } }))?.description,
    ).toBe("секрет");
  });
});
