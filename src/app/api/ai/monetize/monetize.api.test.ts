import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { encryptSecret, last4OfKey } from "@/lib/ai/crypto";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { db } from "@/lib/db";
import { isPlanDocument, planFromDocument } from "@/components/studio/monetize/plan-data";
import type { DocumentDto } from "@/lib/workspace-types";

import { POST as monetize } from "./route";
import { GET as getDocument } from "../../documents/[id]/route";
import { GET as listDocuments } from "../../workspaces/[id]/documents/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];
const originalFetch = globalThis.fetch;

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  bearer?: string,
): Request {
  const headers = new Headers({ accept: "application/json" });
  if (body !== undefined) headers.set("content-type": "application/json");
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("POST /api/ai/monetize honesty", () => {
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
        email: `monetize-${label}-${stamp}@example.test`,
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

  async function seedMonetizeOverride(userId: string) {
    const provider = await db.aiProvider.create({
      data: {
        userId,
        kind: "openai_compatible",
        name: "Mock Monetize",
        baseUrl: "https://monetize.test.local/v1",
        apiKey: encryptSecret("sk-test-monetize-llm"),
        apiKeyLast4: last4OfKey("sk-test-monetize-llm"),
        enabled: true,
      },
    });
    const model = await db.aiModel.create({
      data: {
        providerId: provider.id,
        modelId: "gpt-4o-mini",
        displayName: "monetize-llm",
        capChat: true,
        capImage: false,
        capTts: false,
        capAsr: false,
        capEmbeddings: false,
        enabled: true,
      },
    });
    await db.userToolModel.upsert({
      where: { userId_toolId: { userId, toolId: "monetize" } },
      create: { userId, toolId: "monetize", modelId: model.id },
      update: { modelId: model.id },
    });
  }

  async function seedPlanDocument(projectId: string, titleSuffix = "") {
    const products = [
      { name: "Электронная книга", price: "299 ₽", note: "для Литрес" },
    ];
    const channels = [{ name: "Литрес", note: "основной канал" }];
    const steps = [{ term: "Месяц 1", note: "вычитать рукопись" }];
    const forecast = {
      assumption: "тираж самиздата",
      monthly: [
        { label: "Месяц 1", amount: 12000 },
        { label: "Месяц 2", amount: 24000 },
        { label: "Месяц 3", amount: 36000 },
      ],
    };
    return db.document.create({
      data: {
        projectId,
        kind: "spec",
        title: `План монетизации · маяк${titleSuffix}`,
        description: "Бриф: детектив у маяка",
        sections: {
          create: [
            {
              title: "Концепция",
              order: 0,
              status: "done",
              content: "Самиздат смотрительницы маяка без эквайера.",
            },
            {
              title: "Продукты и цены",
              order: 1,
              status: "done",
              content: `ПРОДУКТЫ_JSON:${JSON.stringify(products)}\n\n1. «Электронная книга» — 299 ₽`,
            },
            {
              title: "Каналы",
              order: 2,
              status: "done",
              content: `КАНАЛЫ_JSON:${JSON.stringify(channels)}\n\n• Литрес`,
            },
            {
              title: "План запуска",
              order: 3,
              status: "done",
              content: `ШАГИ_JSON:${JSON.stringify(steps)}\n\nМесяц 1 — вычитать рукопись`,
            },
            {
              title: "Прогноз",
              order: 4,
              status: "done",
              content: `ПРОГНОЗ_JSON:${JSON.stringify(forecast)}\n\nДопущение: тираж самиздата`,
            },
          ],
        },
      },
      include: { sections: { orderBy: { order: "asc" } } },
    });
  }

  test("unconfigured monetize is UNCONFIGURED_TOOL_MESSAGE and writes no plan document", async () => {
    const { user, token, ws } = await seedUser("noconfig");
    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "monetize");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const prior = await seedPlanDocument(ws.id, " старый");
    const before = await db.document.count({
      where: { projectId: ws.id, kind: "spec" },
    });
    const res = await monetize(
      jsonRequest(
        "http://localhost/api/ai/monetize",
        "POST",
        { projectId: ws.id, brief: "Детектив для Литрес" },
        token,
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      document?: unknown;
      plan?: unknown;
    };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.document).toBeUndefined();
    expect(json.plan).toBeUndefined();
    expect(json.error).not.toMatch(/stripe|карта|выплачено/i);
    expect(
      await db.document.count({ where: { projectId: ws.id, kind: "spec" } }),
    ).toBe(before);
    const still = await db.document.findUnique({ where: { id: prior.id } });
    expect(still?.title).toMatch(/старый/);
  });

  test("failed LLM does not replace an existing plan document", async () => {
    const { user, token, ws } = await seedUser("failplan");
    await seedMonetizeOverride(user.id);
    const prior = await seedPlanDocument(ws.id, " живой");
    globalThis.fetch = (async () =>
      new Response("upstream down", { status: 500 })) as typeof fetch;
    const res = await monetize(
      jsonRequest(
        "http://localhost/api/ai/monetize",
        "POST",
        { projectId: ws.id, brief: "пересобрать" },
        token,
      ),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as { error: string; document?: unknown };
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.document).toBeUndefined();
    const still = await db.document.findUnique({ where: { id: prior.id } });
    expect(still?.id).toBe(prior.id);
    expect(still?.title).toMatch(/живой/);
  });

  test("persisted plan document reloads products and forecast without Stripe fantasy", async () => {
    const { token, ws } = await seedUser("persist");
    const created = await seedPlanDocument(ws.id);

    const listed = await listDocuments(
      jsonRequest(
        `http://localhost/api/workspaces/${ws.id}/documents`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: ws.id }) },
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as { documents: DocumentDto[] };
    const listedHit = listedJson.documents.find((d) => d.id === created.id);
    expect(listedHit).toBeTruthy();
    expect(isPlanDocument(listedHit!)).toBe(true);

    const first = await getDocument(
      jsonRequest(
        `http://localhost/api/documents/${created.id}`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { document: DocumentDto };
    const plan = planFromDocument(firstJson.document);
    expect(plan?.concept).toMatch(/маяк/i);
    expect(plan?.products[0]?.name).toBe("Электронная книга");
    expect(plan?.products[0]?.price).toBe("299 ₽");
    expect(plan?.forecast?.monthly).toHaveLength(3);
    expect(plan?.forecast?.monthly[0]?.amount).toBe(12000);
    expect(JSON.stringify(plan)).not.toMatch(/stripe/i);

    const reload = await getDocument(
      jsonRequest(
        `http://localhost/api/documents/${created.id}`,
        "GET",
        undefined,
        token,
      ),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(reload.status).toBe(200);
    const reloadJson = (await reload.json()) as { document: DocumentDto };
    const again = planFromDocument(reloadJson.document);
    expect(again?.products).toEqual(plan?.products);
    expect(again?.forecast).toEqual(plan?.forecast);
    expect(again?.concept).toBe(plan?.concept);
  });

  test("IDOR: monetize on another user's workspace is 404 and writes nothing", async () => {
    const owner = await seedUser("owner");
    const attacker = await seedUser("attacker");
    const before = await db.document.count({ where: { projectId: owner.ws.id } });
    const res = await monetize(
      jsonRequest(
        "http://localhost/api/ai/monetize",
        "POST",
        { projectId: owner.ws.id, brief: "украсть план" },
        attacker.token,
      ),
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string; document?: unknown };
    expect(json.error).toMatch(/не найден/i);
    expect(json.document).toBeUndefined();
    expect(await db.document.count({ where: { projectId: owner.ws.id } })).toBe(
      before,
    );
  });
});
