import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { encryptSecret, last4OfKey } from "@/lib/ai/crypto";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { db } from "@/lib/db";
import { EMPTY_NOTE_ANALYSIS_MESSAGE } from "@/lib/note-analysis";

import { POST as analyze } from "./[id]/analyze/route";
import { GET as getNote, PATCH as patchNote } from "./[id]/route";
import { GET as listNotes, POST as createNote } from "./route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

function jsonRequest(id: string, bearer?: string, method = "POST"): Request {
  const headers = new Headers({ accept: "application/json" });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(`http://localhost/api/notes/${id}/analyze`, {
    method,
    headers,
  });
}

function getRequest(url: string, bearer: string): Request {
  const headers = new Headers({ accept: "application/json" });
  headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, { method: "GET", headers });
}

function bodyRequest(
  url: string,
  method: string,
  body: unknown,
  bearer: string,
): Request {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${bearer}`,
  });
  return new Request(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("POST /api/notes/[id]/analyze honesty", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `note-analyze-${label}-${stamp}@example.test`,
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
    return { user, token };
  }

  async function seedNotesOverride(userId: string) {
    const provider = await db.aiProvider.create({
      data: {
        userId,
        kind: "openai_compatible",
        name: "Mock Notes",
        baseUrl: "https://notes.test.local/v1",
        apiKey: encryptSecret("sk-test-notes-llm"),
        apiKeyLast4: last4OfKey("sk-test-notes-llm"),
        enabled: true,
      },
    });
    const model = await db.aiModel.create({
      data: {
        providerId: provider.id,
        modelId: "gpt-4o-mini",
        displayName: "notes-llm",
        capChat: true,
        capImage: false,
        capTts: false,
        capAsr: false,
        capEmbeddings: false,
        enabled: true,
      },
    });
    await db.userToolModel.upsert({
      where: { userId_toolId: { userId, toolId: "notes" } },
      create: { userId, toolId: "notes", modelId: model.id },
      update: { modelId: model.id },
    });
  }

  test("empty note is 422 and is not re-queued as success", async () => {
    const { user, token } = await seedUser("empty");
    const empty = await db.note.create({
      data: { userId: user.id, rawText: "  ", status: "pending" },
    });
    const res = await analyze(jsonRequest(empty.id, token), {
      params: Promise.resolve({ id: empty.id }),
    });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { error: string; note?: { status: string } };
    expect(json.error).toBe(EMPTY_NOTE_ANALYSIS_MESSAGE);
    expect(json.note).toBeUndefined();
    const still = await db.note.findUnique({ where: { id: empty.id } });
    expect(still?.status).toBe("pending");
    expect(still?.analyzedAt).toBeNull();
    expect(still?.positiveBlock).toBeNull();
  });

  test("missing note is 404 in Russian", async () => {
    const { token } = await seedUser("missing");
    const res = await analyze(jsonRequest("missing-note-id", token), {
      params: Promise.resolve({ id: "missing-note-id" }),
    });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/не найдена/i);
  });

  test("unconfigured notes is UNCONFIGURED_TOOL_MESSAGE and status error, not fake 4-block JSON", async () => {
    const { user, token } = await seedUser("noconfig");
    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "notes");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const note = await db.note.create({
      data: {
        userId: user.id,
        rawText: "Шторм у маяка ночью",
        status: "pending",
        positiveBlock: "старый позитив",
        negativeBlock: "старый негатив",
        finalBlock: "старый вывод",
        recommendations: JSON.stringify(["старое"]),
      },
    });
    const res = await analyze(jsonRequest(note.id, token), {
      params: Promise.resolve({ id: note.id }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      note?: {
        status: string;
        positive: string | null;
        negative: string | null;
        final: string | null;
        recommendations: string[] | null;
        errorMessage: string | null;
      };
    };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.error).toMatch(/[А-Яа-яЁё]/);
    expect(json.note?.status).toBe("error");
    expect(json.note?.errorMessage).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.note?.positive).toBeNull();
    expect(json.note?.negative).toBeNull();
    expect(json.note?.final).toBeNull();
    expect(json.note?.recommendations).toBeNull();

    const row = await db.note.findUnique({ where: { id: note.id } });
    expect(row?.status).toBe("error");
    expect(row?.errorMessage).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(row?.positiveBlock).toBeNull();
    expect(row?.negativeBlock).toBeNull();
    expect(row?.finalBlock).toBeNull();
    expect(row?.recommendations).toBeNull();
  });

  test("IDOR: analyzing another user's note is 404 and does not mutate it", async () => {
    const owner = await seedUser("owner");
    const attacker = await seedUser("attacker");
    const note = await db.note.create({
      data: {
        userId: owner.user.id,
        rawText: "секретная мысль владельца",
        status: "processed",
        positiveBlock: "сила",
        negativeBlock: "риск",
        finalBlock: "вывод",
      },
    });
    const res = await analyze(jsonRequest(note.id, attacker.token), {
      params: Promise.resolve({ id: note.id }),
    });
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string; note?: unknown };
    expect(json.error).toMatch(/не найдена/i);
    expect(json.note).toBeUndefined();
    const still = await db.note.findUnique({ where: { id: note.id } });
    expect(still?.userId).toBe(owner.user.id);
    expect(still?.status).toBe("processed");
    expect(still?.positiveBlock).toBe("сила");
    expect(still?.finalBlock).toBe("вывод");
  });

  test("processed analysis fields persist on GET reload", async () => {
    const { user, token } = await seedUser("persist");
    await seedNotesOverride(user.id);
    const recs = ["Снять ночь у маяка", "Убрать лишнюю экспозицию"];
    const note = await db.note.create({
      data: {
        userId: user.id,
        rawText: "Клип про смотрительницу маяка",
        status: "processed",
        positiveBlock: "Сильный визуальный якорь.",
        negativeBlock: "Риск клише.",
        finalBlock: "Держать одну ночь.",
        recommendations: JSON.stringify(recs),
        analyzedAt: new Date(),
      },
    });

    const first = await getNote(getRequest(`http://localhost/api/notes/${note.id}`, token), {
      params: Promise.resolve({ id: note.id }),
    });
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as {
      note: {
        status: string;
        positive: string | null;
        negative: string | null;
        final: string | null;
        recommendations: string[] | null;
        analyzedAt: string | null;
      };
    };
    expect(firstJson.note.status).toBe("processed");
    expect(firstJson.note.positive).toBe("Сильный визуальный якорь.");
    expect(firstJson.note.negative).toBe("Риск клише.");
    expect(firstJson.note.final).toBe("Держать одну ночь.");
    expect(firstJson.note.recommendations).toEqual(recs);
    expect(firstJson.note.analyzedAt).toBeTruthy();

    const reload = await getNote(
      getRequest(`http://localhost/api/notes/${note.id}`, token),
      { params: Promise.resolve({ id: note.id }) },
    );
    expect(reload.status).toBe(200);
    const reloadJson = (await reload.json()) as { note: typeof firstJson.note };
    expect(reloadJson.note.positive).toBe(firstJson.note.positive);
    expect(reloadJson.note.final).toBe(firstJson.note.final);
    expect(reloadJson.note.recommendations).toEqual(recs);

    const listed = await listNotes(
      getRequest("http://localhost/api/notes?limit=20", token),
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      notes: Array<{ id: string; positive: string | null }>;
    };
    const hit = listedJson.notes.find((n) => n.id === note.id);
    expect(hit?.positive).toBe("Сильный визуальный якорь.");
  });

  test("empty notebook list is [] — not an error payload", async () => {
    const { token } = await seedUser("emptylist");
    const listed = await listNotes(
      getRequest("http://localhost/api/notes?limit=20", token),
    );
    expect(listed.status).toBe(200);
    const json = (await listed.json()) as {
      notes: unknown[];
      total: number;
      error?: string;
    };
    expect(json.notes).toEqual([]);
    expect(json.total).toBe(0);
    expect(json.error).toBeUndefined();
  });

  test("POST unconfigured notes is error on GET without waiting for the worker", async () => {
    const { user, token } = await seedUser("postnoconfig");
    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "notes");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const created = await createNote(
      bodyRequest(
        "http://localhost/api/notes",
        "POST",
        { text: "Шторм у маяка ночью" },
        token,
      ),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      note: {
        id: string;
        status: string;
        errorMessage: string | null;
        positive: string | null;
      };
    };
    expect(createdJson.note.status).toBe("error");
    expect(createdJson.note.errorMessage).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(createdJson.note.positive).toBeNull();

    const got = await getNote(
      getRequest(`http://localhost/api/notes/${createdJson.note.id}`, token),
      { params: Promise.resolve({ id: createdJson.note.id }) },
    );
    expect(got.status).toBe(200);
    const gotJson = (await got.json()) as {
      note: {
        status: string;
        errorMessage: string | null;
        positive: string | null;
        negative: string | null;
        final: string | null;
      };
    };
    expect(gotJson.note.status).toBe("error");
    expect(gotJson.note.errorMessage).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(gotJson.note.positive).toBeNull();
    expect(gotJson.note.negative).toBeNull();
    expect(gotJson.note.final).toBeNull();

    const row = await db.note.findUnique({ where: { id: createdJson.note.id } });
    expect(row?.status).toBe("error");
    expect(row?.errorMessage).toBe(UNCONFIGURED_TOOL_MESSAGE);
  });

  test("PATCH text with unconfigured notes is error, not pending", async () => {
    const { user, token } = await seedUser("patchnoconfig");
    let unconfigured = false;
    try {
      await resolveToolRoute(db, user.id, "notes");
    } catch (err) {
      unconfigured =
        err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }

    const note = await db.note.create({
      data: {
        userId: user.id,
        rawText: "старый текст",
        status: "processed",
        positiveBlock: "старый позитив",
        finalBlock: "старый вывод",
      },
    });
    const patched = await patchNote(
      bodyRequest(
        `http://localhost/api/notes/${note.id}`,
        "PATCH",
        { rawText: "новый шторм у маяка" },
        token,
      ),
      { params: Promise.resolve({ id: note.id }) },
    );
    expect(patched.status).toBe(200);
    const json = (await patched.json()) as {
      note: { status: string; errorMessage: string | null; positive: string | null };
    };
    expect(json.note.status).toBe("error");
    expect(json.note.errorMessage).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.note.positive).toBeNull();
  });

  test("POST with configured notes still queues as pending", async () => {
    const { user, token } = await seedUser("postconfig");
    await seedNotesOverride(user.id);
    const created = await createNote(
      bodyRequest(
        "http://localhost/api/notes",
        "POST",
        { text: "Клип про смотрительницу маяка" },
        token,
      ),
    );
    expect(created.status).toBe(201);
    const json = (await created.json()) as {
      note: { id: string; status: string; errorMessage: string | null };
    };
    expect(json.note.status).toBe("pending");
    expect(json.note.errorMessage).toBeNull();
    const row = await db.note.findUnique({ where: { id: json.note.id } });
    expect(row?.status).toBe("pending");
    expect(row?.errorMessage).toBeNull();
  });
});
