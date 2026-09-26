import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { db } from "@/lib/db";

import { POST as rewriteSelection } from "./route";

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
  if (body !== undefined) headers.set("content-type", "application/json");
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("POST /api/ai/selection", () => {
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
        email: `selection-${label}-${stamp}@example.test`,
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
    const document = await db.document.create({
      data: { projectId: ws.id, title: "Рукопись" },
    });
    const rest = `UNIQUE-REST-${label}-${stamp}`;
    const section = await db.documentSection.create({
      data: {
        documentId: document.id,
        title: "гл. 1",
        content: `У маяка шторм. ${rest} чайки кричали.`,
      },
    });
    return { user, token, section, rest };
  }

  async function seedModel(userId: string) {
    const provider = await db.aiProvider.create({
      data: {
        userId,
        kind: "openai_compatible",
        name: "Selection test",
        baseUrl: "http://llm.test/v1",
        apiKey: "sk-test-key-1234",
        apiKeyLast4: "1234",
        enabled: true,
        visibleToUsers: false,
      },
    });
    const model = await db.aiModel.create({
      data: {
        providerId: provider.id,
        modelId: "test-selection",
        displayName: "Test selection",
        capChat: true,
        enabled: true,
      },
    });
    await db.userToolModel.create({
      data: { userId, toolId: "rewrite_section", modelId: model.id },
    });
  }

  async function toolUnconfigured(userId: string): Promise<boolean> {
    try {
      await resolveToolRoute(db, userId, "rewrite_section");
      return false;
    } catch (err) {
      return (
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE
      );
    }
  }

  test("unconfigured rewrite_section is 400 and does not touch the chapter", async () => {
    const { user, token, section } = await seedUser("noconfig");
    if (!(await toolUnconfigured(user.id))) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const original = section.content;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      await new Promise((r) => setTimeout(r, 30_000));
      return new Response("should not hang", { status: 500 });
    }) as typeof fetch;

    const started = Date.now();
    const res = await rewriteSelection(
      jsonRequest(
        "http://localhost/api/ai/selection",
        "POST",
        {
          sectionId: section.id,
          selection: "шторм",
          instruction: "сделай короче",
        },
        token,
      ),
    );
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(fetchCalls).toBe(0);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; text?: unknown };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.text).toBeUndefined();
    const still = await db.documentSection.findUnique({ where: { id: section.id } });
    expect(still?.content).toBe(original);
  });

  test("returns the fragment only and leaves the stored chapter", async () => {
    const { user, token, section, rest } = await seedUser("rewrite");
    await seedModel(user.id);
    const original = section.content;
    let userPrompt = "";

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        messages?: Array<{ role: string; content: string }>;
      };
      userPrompt =
        body.messages?.find((message) => message.role === "user")?.content ?? "";
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "```text\nбуря\n```" } }],
          usage: { prompt_tokens: 12, completion_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const res = await rewriteSelection(
      jsonRequest(
        "http://localhost/api/ai/selection",
        "POST",
        {
          sectionId: section.id,
          selection: "шторм",
          instruction: "сделай короче",
        },
        token,
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { text: string };
    expect(json.text).toBe("буря");
    expect(userPrompt).toContain("шторм");
    expect(userPrompt).toContain("сделай короче");
    expect(userPrompt).not.toContain(rest);
    const still = await db.documentSection.findUnique({ where: { id: section.id } });
    expect(still?.content).toBe(original);
  });

  test("empty selection and empty model text do not rewrite the chapter", async () => {
    const { user, token, section } = await seedUser("empty");
    await seedModel(user.id);

    const original = section.content;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "```\n\n```" } }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const missing = await rewriteSelection(
      jsonRequest(
        "http://localhost/api/ai/selection",
        "POST",
        { sectionId: section.id, selection: "", instruction: "короче" },
        token,
      ),
    );
    expect(missing.status).toBe(400);
    expect(fetchCalls).toBe(0);

    const emptyModel = await rewriteSelection(
      jsonRequest(
        "http://localhost/api/ai/selection",
        "POST",
        { sectionId: section.id, selection: "шторм", instruction: "удали" },
        token,
      ),
    );
    expect(emptyModel.status).toBe(502);
    expect(fetchCalls).toBe(1);
    const still = await db.documentSection.findUnique({ where: { id: section.id } });
    expect(still?.content).toBe(original);
  });
});
