import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { db } from "@/lib/db";

import { POST as rewriteSection } from "./route";

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

describe.skipIf(SKIP_PG)("POST /api/ai/section honesty", () => {
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
        email: `section-${label}-${stamp}@example.test`,
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
    const section = await db.documentSection.create({
      data: {
        documentId: document.id,
        title: "гл. 1",
        content: `У маяка шторм ${label}-${stamp}.`,
      },
    });
    return { user, token, section };
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

  test("unconfigured rewrite_section is 400 UNCONFIGURED and does not rewrite", async () => {
    const { user, token, section } = await seedUser("noconfig");
    if (!(await toolUnconfigured(user.id))) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const original = section.content;
    const beforeRevs = await db.documentSectionRevision.count({
      where: { sectionId: section.id },
    });

    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      await new Promise((r) => setTimeout(r, 30_000));
      return new Response("should not hang", { status: 500 });
    }) as typeof fetch;

    const started = Date.now();
    const res = await rewriteSection(
      jsonRequest(
        "http://localhost/api/ai/section",
        "POST",
        { sectionId: section.id, action: "rewrite" },
        token,
      ),
    );
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(fetchCalls).toBe(0);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; section?: unknown };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.section).toBeUndefined();

    const still = await db.documentSection.findUnique({
      where: { id: section.id },
    });
    expect(still?.content).toBe(original);
    expect(
      await db.documentSectionRevision.count({
        where: { sectionId: section.id },
      }),
    ).toBe(beforeRevs);
  });

  test("unconfigured write/continue/custom share the same 400 and leave the chapter", async () => {
    const { user, token, section } = await seedUser("actions");
    if (!(await toolUnconfigured(user.id))) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const original = section.content;
    const actions: Array<{
      action: "write" | "continue" | "custom";
      instruction?: string;
    }> = [
      { action: "write" },
      { action: "continue" },
      { action: "custom", instruction: "короче, от лица Марины" },
    ];

    globalThis.fetch = (async () => {
      await new Promise((r) => setTimeout(r, 30_000));
      return new Response("should not hang", { status: 500 });
    }) as typeof fetch;

    for (const body of actions) {
      const started = Date.now();
      const res = await rewriteSection(
        jsonRequest(
          "http://localhost/api/ai/section",
          "POST",
          { sectionId: section.id, ...body },
          token,
        ),
      );
      expect(Date.now() - started).toBeLessThan(2_000);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string; section?: unknown };
      expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
      expect(json.section).toBeUndefined();
    }

    const still = await db.documentSection.findUnique({
      where: { id: section.id },
    });
    expect(still?.content).toBe(original);
    expect(
      await db.documentSectionRevision.count({
        where: { sectionId: section.id },
      }),
    ).toBe(0);
  });
});
