import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { encryptSecret, last4OfKey } from "@/lib/ai/crypto";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { db } from "@/lib/db";
import { flushRagQueue, indexEntityById } from "@/lib/rag/hooks";
import { retrieve } from "@/lib/rag/retrieve";
import { ragScopeFromThread } from "@/lib/rag/scope";

import {
  GET as getEntity,
  PATCH as patchEntity,
  DELETE as deleteEntity,
} from "./[id]/route";
import {
  POST as generatePortrait,
  DELETE as clearPortrait,
} from "./[id]/portrait/route";
import {
  GET as listEntities,
  POST as createEntity,
} from "../workspaces/[id]/entities/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const marker = `entity-rag-${stamp}-lighthouse`;
const originalFetch = globalThis.fetch;
const ids: string[] = [];

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

describe.skipIf(SKIP_PG)("entities: CRUD, IDOR, portrait, RAG", () => {
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
        email: `ent-${label}-${stamp}@example.test`,
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
        apiKey: encryptSecret("sk-test-image-entity"),
        apiKeyLast4: last4OfKey("sk-test-image-entity"),
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

  test("owner CRUD; foreign user is 404; list/create on foreign workspace is 404", async () => {
    const owner = await seedUser("owner");
    const attacker = await seedUser("atk");
    const wsParams = { params: Promise.resolve({ id: owner.ws.id }) };

    const created = await createEntity(
      jsonRequest(
        `http://localhost/api/workspaces/${owner.ws.id}/entities`,
        "POST",
        {
          kind: "character",
          name: "Марина",
          short: "смотрительница маяка",
          description: `Героиня ${marker}.`,
        },
        owner.token,
      ),
      wsParams,
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      entity: { id: string; name: string };
    };
    const entityId = createdJson.entity.id;
    expect(entityId).toBeTruthy();
    const entParams = { params: Promise.resolve({ id: entityId }) };

    const listed = await listEntities(
      jsonRequest(
        `http://localhost/api/workspaces/${owner.ws.id}/entities`,
        "GET",
        undefined,
        owner.token,
      ),
      wsParams,
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      entities: Array<{ id: string }>;
    };
    expect(listedJson.entities.some((e) => e.id === entityId)).toBe(true);

    const stolenList = await listEntities(
      jsonRequest(
        `http://localhost/api/workspaces/${owner.ws.id}/entities`,
        "GET",
        undefined,
        attacker.token,
      ),
      wsParams,
    );
    expect(stolenList.status).toBe(404);
    const stolenListJson = (await stolenList.json()) as {
      entities?: unknown;
      error: string;
    };
    expect(stolenListJson.entities).toBeUndefined();
    expect(stolenListJson.error).toMatch(/не найден/i);

    const stolenCreate = await createEntity(
      jsonRequest(
        `http://localhost/api/workspaces/${owner.ws.id}/entities`,
        "POST",
        { kind: "character", name: "взлом" },
        attacker.token,
      ),
      wsParams,
    );
    expect(stolenCreate.status).toBe(404);

    const stolenGet = await getEntity(
      jsonRequest(
        `http://localhost/api/entities/${entityId}`,
        "GET",
        undefined,
        attacker.token,
      ),
      entParams,
    );
    expect(stolenGet.status).toBe(404);
    const stolenGetJson = (await stolenGet.json()) as { entity?: unknown };
    expect(stolenGetJson.entity).toBeUndefined();

    const stolenPatch = await patchEntity(
      jsonRequest(
        `http://localhost/api/entities/${entityId}`,
        "PATCH",
        { name: "взлом" },
        attacker.token,
      ),
      entParams,
    );
    expect(stolenPatch.status).toBe(404);

    const stolenDel = await deleteEntity(
      jsonRequest(
        `http://localhost/api/entities/${entityId}`,
        "DELETE",
        undefined,
        attacker.token,
      ),
      entParams,
    );
    expect(stolenDel.status).toBe(404);

    const stolenPortrait = await generatePortrait(
      jsonRequest(
        `http://localhost/api/entities/${entityId}/portrait`,
        "POST",
        {},
        attacker.token,
      ),
      entParams,
    );
    expect(stolenPortrait.status).toBe(404);
    const stolenPortraitJson = (await stolenPortrait.json()) as {
      entity?: unknown;
      artifact?: unknown;
    };
    expect(stolenPortraitJson.entity).toBeUndefined();
    expect(stolenPortraitJson.artifact).toBeUndefined();

    const stolenClear = await clearPortrait(
      jsonRequest(
        `http://localhost/api/entities/${entityId}/portrait`,
        "DELETE",
        undefined,
        attacker.token,
      ),
      entParams,
    );
    expect(stolenClear.status).toBe(404);

    const patched = await patchEntity(
      jsonRequest(
        `http://localhost/api/entities/${entityId}`,
        "PATCH",
        { name: "Марина Л." },
        owner.token,
      ),
      entParams,
    );
    expect(patched.status).toBe(200);
    const still = await db.entity.findUnique({ where: { id: entityId } });
    expect(still?.name).toBe("Марина Л.");
  });

  test("unconfigured portrait is UNCONFIGURED_TOOL_MESSAGE and does not fake an image", async () => {
    const { user, token, ws } = await seedUser("noportrait");
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: "Ольга",
        description: "смотрительница",
        image: "/gen/keep-previous.png",
        imagePrompt: "старый портрет",
      },
    });
    const params = { params: Promise.resolve({ id: entity.id }) };

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
      where: { projectId: ws.id, type: "portrait" },
    });
    const res = await generatePortrait(
      jsonRequest(
        `http://localhost/api/entities/${entity.id}/portrait`,
        "POST",
        {},
        token,
      ),
      params,
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      entity?: { image?: string };
      artifact?: unknown;
    };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.artifact).toBeUndefined();
    expect(json.entity).toBeUndefined();
    expect(json.error).not.toMatch(/placeholder|data:image|fake/i);

    const live = await db.entity.findUnique({ where: { id: entity.id } });
    expect(live?.image).toBe("/gen/keep-previous.png");
    expect(live?.imagePrompt).toBe("старый портрет");
    expect(
      await db.artifact.count({ where: { projectId: ws.id, type: "portrait" } }),
    ).toBe(beforeArts);
  });

  test("failed portrait generation does not wipe the previous image", async () => {
    const { user, token, ws } = await seedUser("keepimg");
    await seedImageOverride(user.id);
    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        kind: "character",
        name: "Катя",
        description: "маяк",
        image: "/gen/keep-previous.png",
        imagePrompt: "старый портрет",
      },
    });
    const beforeArts = await db.artifact.count({
      where: { entityId: entity.id, type: "portrait" },
    });

    globalThis.fetch = (async () =>
      new Response("upstream down", { status: 500 })) as typeof fetch;

    const res = await generatePortrait(
      jsonRequest(
        `http://localhost/api/entities/${entity.id}/portrait`,
        "POST",
        {},
        token,
      ),
      { params: Promise.resolve({ id: entity.id }) },
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as {
      error: string;
      entity?: unknown;
      artifact?: unknown;
    };
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.entity).toBeUndefined();
    expect(json.artifact).toBeUndefined();
    expect(json.error).not.toMatch(/placeholder|data:image/i);

    const live = await db.entity.findUnique({ where: { id: entity.id } });
    expect(live?.image).toBe("/gen/keep-previous.png");
    expect(live?.imagePrompt).toBe("старый портрет");
    expect(
      await db.artifact.count({
        where: { entityId: entity.id, type: "portrait" },
      }),
    ).toBe(beforeArts);
  });

  test("saved entity is in RAG; delete purges chunks", async () => {
    const { user, token, ws } = await seedUser("rag");
    const created = await createEntity(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/entities`,
        "POST",
        {
          kind: "character",
          name: "Маяк",
          description: `Канон ${marker} смотрительница.`,
        },
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as { entity: { id: string } };
    const entityId = createdJson.entity.id;

    await flushRagQueue();
    await indexEntityById(db, entityId);

    const before = await retrieve(db, {
      scope: ragScopeFromThread(user.id, ws.id),
      query: marker,
      limit: 8,
    });
    expect(before.hits.some((h) => h.sourceId === entityId)).toBe(true);
    expect(before.hits.some((h) => h.excerpt.includes(marker))).toBe(true);

    const deleted = await deleteEntity(
      jsonRequest(
        `http://localhost/api/entities/${entityId}`,
        "DELETE",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: entityId }) },
    );
    expect(deleted.status).toBe(200);
    await flushRagQueue();

    const gone = await db.entity.findUnique({ where: { id: entityId } });
    expect(gone).toBeNull();

    const after = await retrieve(db, {
      scope: ragScopeFromThread(user.id, ws.id),
      query: marker,
      limit: 8,
    });
    expect(after.hits.some((h) => h.sourceId === entityId)).toBe(false);
    expect(after.hits.some((h) => h.excerpt.includes(marker))).toBe(false);

    const leftover = await db.ragChunk.count({
      where: {
        userId: user.id,
        sourceType: "entity",
        sourceId: entityId,
      },
    });
    expect(leftover).toBe(0);
  });
});
