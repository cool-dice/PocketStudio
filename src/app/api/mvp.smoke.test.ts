import { afterAll, describe, expect, test } from "bun:test";

import { POST as register } from "./auth/register/route";
import { POST as createNote, GET as listNotes } from "./notes/route";
import { POST as createWorkspace } from "./workspaces/route";
import { POST as aiImage } from "./ai/image/route";
import { db } from "@/lib/db";
import { hashPassword, signSession } from "@/lib/auth";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";

const stamp = Date.now().toString(36);
const email = `mvp-smoke-${stamp}@example.test`;
let userId: string | null = null;
let token: string | null = null;
let workspaceId: string | null = null;

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

afterAll(async () => {
  if (userId) {
    await db.user.delete({ where: { id: userId } }).catch(() => {});
  }
  await db.$disconnect().catch(() => {});
});

describe("MVP smoke: auth", () => {
  test("register rejects invalid JSON", async () => {
    const res = await register(
      new Request("http://localhost/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/JSON/i);
  });

  test("register rejects short password with Russian fields", async () => {
    const res = await register(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        name: "Тест",
        email: `bad-${stamp}@example.test`,
        password: "short",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; fields?: Record<string, string> };
    expect(json.error).toBeTruthy();
    expect(json.fields?.password ?? json.error).toMatch(/парол/i);
  });
});

describe("MVP smoke: workspaces + notes", () => {
  test("unauthenticated workspace create is 401", async () => {
    const res = await createWorkspace(
      jsonRequest("http://localhost/api/workspaces", "POST", {
        type: "book",
        name: "Тишина",
      }),
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/авторизац/i);
  });

  test("creates a user, workspace, and linked note", async () => {
    const user = await db.user.create({
      data: {
        name: "Smoke",
        email,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    userId = user.id;
    token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const wsRes = await createWorkspace(
      jsonRequest(
        "http://localhost/api/workspaces",
        "POST",
        { type: "book", name: "Маяк", description: "smoke" },
        token,
      ),
    );
    expect(wsRes.status).toBe(201);
    const wsJson = (await wsRes.json()) as { workspace: { id: string; name: string } };
    expect(wsJson.workspace.name).toBe("Маяк");
    workspaceId = wsJson.workspace.id;

    const noteRes = await createNote(
      jsonRequest(
        "http://localhost/api/notes",
        "POST",
        { text: "маяк в тумане", projectId: workspaceId },
        token,
      ),
    );
    expect(noteRes.status).toBe(201);
    const noteJson = (await noteRes.json()) as { note: { id: string; rawText: string } };
    expect(noteJson.note.rawText).toContain("маяк");

    const listRes = await listNotes(
      jsonRequest(
        `http://localhost/api/notes?projectId=${encodeURIComponent(workspaceId!)}`,
        "GET",
        undefined,
        token,
      ),
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { notes: Array<{ id: string }> };
    expect(listJson.notes.some((n) => n.id === noteJson.note.id)).toBe(true);
  });
});

describe("MVP smoke: AI unconfigured", () => {
  test("image generation fails in Russian when no provider is set for the user", async () => {
    expect(token && workspaceId).toBeTruthy();
    const res = await aiImage(
      jsonRequest(
        "http://localhost/api/ai/image",
        "POST",
        { projectId: workspaceId, prompt: "маяк в тумане ночью" },
        token!,
      ),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = (await res.json()) as { error: string };
    expect(typeof json.error).toBe("string");
    expect(json.error.length).toBeGreaterThan(8);
    // Fresh user has no BYOK and typically no platform default in CI.
    // If a default exists locally, the message is still Russian (not a stack).
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    if (res.status === 400) {
      expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    }
  });
});
