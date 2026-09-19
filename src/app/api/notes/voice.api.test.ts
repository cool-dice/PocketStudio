import { afterAll, afterEach, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { encryptSecret, last4OfKey } from "@/lib/ai/crypto";
import { GatewayError } from "@/lib/ai/errors";
import { resolveToolRoute } from "@/lib/ai/resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { db } from "@/lib/db";
import { ASR_EMPTY } from "@/lib/voice-copy";

import { POST as createNote } from "./route";
import { POST as voice } from "./voice/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const AUDIO = Buffer.from("RIFFWAVEfmt ").toString("base64");
const originalFetch = globalThis.fetch;

function jsonRequest(
  body: unknown,
  bearer?: string,
): Request {
  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request("http://localhost/api/notes/voice", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("POST /api/notes/voice honesty", () => {
  let userId: string | null = null;
  let token: string | null = null;

  async function seedUser() {
    if (userId && token) return;
    const user = await db.user.create({
      data: {
        name: "Voice",
        email: `voice-api-${stamp}@example.test`,
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
  }

  async function seedAsrOverride() {
    await seedUser();
    const existing = await db.userToolModel.findUnique({
      where: { userId_toolId: { userId: userId!, toolId: "asr" } },
    });
    if (existing?.modelId) return;
    const provider = await db.aiProvider.create({
      data: {
        userId: userId!,
        kind: "openai_compatible",
        name: "Mock ASR",
        baseUrl: "https://asr.test.local/v1",
        apiKey: encryptSecret("sk-test-asr-voice"),
        apiKeyLast4: last4OfKey("sk-test-asr-voice"),
        enabled: true,
      },
    });
    const model = await db.aiModel.create({
      data: {
        providerId: provider.id,
        modelId: "whisper-1",
        displayName: "whisper",
        capChat: false,
        capAsr: true,
        enabled: true,
      },
    });
    await db.userToolModel.upsert({
      where: { userId_toolId: { userId: userId!, toolId: "asr" } },
      create: { userId: userId!, toolId: "asr", modelId: model.id },
      update: { modelId: model.id },
    });
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterAll(async () => {
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  test("401 without a session", async () => {
    const res = await voice(jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }));
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string; note?: unknown };
    expect(json.error).toMatch(/авторизац/i);
    expect(json.note).toBeUndefined();
  });

  test("400 on missing audio or bad mime", async () => {
    await seedUser();
    const missing = await voice(jsonRequest({ mime: "audio/wav" }, token!));
    expect(missing.status).toBe(400);
    const missingJson = (await missing.json()) as { error: string };
    expect(missingJson.error).toMatch(/аудио/i);

    const badMime = await voice(
      jsonRequest({ audioBase64: AUDIO, mime: "video/mp4" }, token!),
    );
    expect(badMime.status).toBe(400);
    const badJson = (await badMime.json()) as { error: string };
    expect(badJson.error).toMatch(/формат/i);
  });

  test("unconfigured ASR is UNCONFIGURED_TOOL_MESSAGE and saves no note", async () => {
    await seedUser();
    let unconfigured = false;
    try {
      await resolveToolRoute(db, userId!, "asr");
    } catch (err) {
      unconfigured = err instanceof GatewayError
        && err.message === UNCONFIGURED_TOOL_MESSAGE;
    }
    if (!unconfigured) {
      expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
      return;
    }
    const before = await db.note.count({ where: { userId: userId! } });
    const res = await voice(
      jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }, token!),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; note?: unknown };
    expect(json.error).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(json.note).toBeUndefined();
    expect(await db.note.count({ where: { userId: userId! } })).toBe(before);
  });

  test("empty transcript and stub «успешно записано» are 422 and save nothing", async () => {
    await seedAsrOverride();
    const before = await db.note.count({ where: { userId: userId! } });

    for (const payload of [{}, { text: "   " }, { text: "успешно записано" }]) {
      globalThis.fetch = (async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "content-type": "application/json" },
        })) as typeof fetch;
      const res = await voice(
        jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }, token!),
      );
      expect(res.status).toBe(422);
      const json = (await res.json()) as { error: string; note?: unknown };
      expect(json.error).toBe(ASR_EMPTY);
      expect(json.error).not.toMatch(/успешно записано/i);
      expect(json.note).toBeUndefined();
    }

    expect(await db.note.count({ where: { userId: userId! } })).toBe(before);
  });

  test("ASR 500 and timeout are Russian errors and save no note", async () => {
    await seedAsrOverride();
    const before = await db.note.count({ where: { userId: userId! } });

    globalThis.fetch = (async () =>
      new Response("upstream down", { status: 500 })) as typeof fetch;
    const fail = await voice(
      jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }, token!),
    );
    expect(fail.status).toBe(502);
    const failJson = (await fail.json()) as { error: string; note?: unknown };
    expect(failJson.error).toMatch(/[А-Яа-яЁё]/);
    expect(failJson.error).not.toMatch(/успешно записано/i);
    expect(failJson.note).toBeUndefined();

    globalThis.fetch = (async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    }) as typeof fetch;
    const timeout = await voice(
      jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }, token!),
    );
    expect(timeout.status).toBe(504);
    const timeoutJson = (await timeout.json()) as { error: string; note?: unknown };
    expect(timeoutJson.error).toMatch(/вовремя/);
    expect(timeoutJson.note).toBeUndefined();

    expect(await db.note.count({ where: { userId: userId! } })).toBe(before);
  });

  test("real transcript is returned, not a success stub, and no note is created", async () => {
    await seedAsrOverride();
    const before = await db.note.count({ where: { userId: userId! } });
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("https://asr.test.local/v1/audio/transcriptions");
      return new Response(JSON.stringify({ text: "маяк в тумане" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    const res = await voice(
      jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }, token!),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { text: string; note?: unknown };
    expect(json.text).toBe("маяк в тумане");
    expect(json.text).not.toMatch(/успешно записано/i);
    expect(json.note).toBeUndefined();
    expect(await db.note.count({ where: { userId: userId! } })).toBe(before);
  });

  test("one voice success then one save creates exactly one note row", async () => {
    await seedAsrOverride();
    const beforeNotes = await db.note.count({ where: { userId: userId! } });
    const beforeLinks = await db.noteLink.count({
      where: { note: { userId: userId! } },
    });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ text: "маяк в тумане" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const asr = await voice(
      jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }, token!),
    );
    expect(asr.status).toBe(200);
    const asrJson = (await asr.json()) as { text: string; note?: unknown };
    expect(asrJson.text).toBe("маяк в тумане");
    expect(asrJson.note).toBeUndefined();
    expect(await db.note.count({ where: { userId: userId! } })).toBe(beforeNotes);

    const headers = new Headers({
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token!}`,
    });
    const save = await createNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: asrJson.text,
          transcription: asrJson.text,
        }),
      }),
    );
    expect(save.status).toBe(201);
    const saved = (await save.json()) as {
      note: { id: string; rawText: string; transcription: string | null };
    };
    expect(saved.note.rawText).toBe("маяк в тумане");
    expect(saved.note.transcription).toBe("маяк в тумане");

    const row = await db.note.findUnique({
      where: { id: saved.note.id },
      select: { rawText: true, transcription: true },
    });
    expect(row?.rawText).toBe("маяк в тумане");
    expect(row?.transcription).toBe("маяк в тумане");

    expect(await db.note.count({ where: { userId: userId! } })).toBe(
      beforeNotes + 1,
    );
    expect(
      await db.noteLink.count({ where: { note: { userId: userId! } } }),
    ).toBe(beforeLinks);

    const secondAsr = await voice(
      jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }, token!),
    );
    expect(secondAsr.status).toBe(200);
    expect(await db.note.count({ where: { userId: userId! } })).toBe(
      beforeNotes + 1,
    );

    await db.note.delete({ where: { id: saved.note.id } });
  });

  test("save-from-voice keeps transcription when the user edits rawText", async () => {
    await seedAsrOverride();
    const beforeNotes = await db.note.count({ where: { userId: userId! } });

    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ text: "маяк в тумане" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    const asr = await voice(
      jsonRequest({ audioBase64: AUDIO, mime: "audio/wav" }, token!),
    );
    expect(asr.status).toBe(200);
    const asrJson = (await asr.json()) as { text: string };
    expect(asrJson.text).toBe("маяк в тумане");
    expect(await db.note.count({ where: { userId: userId! } })).toBe(
      beforeNotes,
    );

    const headers = new Headers({
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token!}`,
    });
    const save = await createNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers,
        body: JSON.stringify({
          text: "маяк в тумане, проверить свет",
          transcription: asrJson.text,
        }),
      }),
    );
    expect(save.status).toBe(201);
    const saved = (await save.json()) as {
      note: { id: string; rawText: string; transcription: string | null };
    };
    expect(saved.note.rawText).toBe("маяк в тумане, проверить свет");
    expect(saved.note.transcription).toBe("маяк в тумане");
    expect(await db.note.count({ where: { userId: userId! } })).toBe(
      beforeNotes + 1,
    );

    const row = await db.note.findUnique({
      where: { id: saved.note.id },
      select: { rawText: true, transcription: true },
    });
    expect(row?.rawText).toBe("маяк в тумане, проверить свет");
    expect(row?.transcription).toBe("маяк в тумане");

    await db.note.delete({ where: { id: saved.note.id } });
  });

  test("typed notes can leave transcription null", async () => {
    await seedUser();
    const headers = new Headers({
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token!}`,
    });
    const save = await createNote(
      new Request("http://localhost/api/notes", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: "просто набранная мысль" }),
      }),
    );
    expect(save.status).toBe(201);
    const saved = (await save.json()) as {
      note: { id: string; rawText: string; transcription: string | null };
    };
    expect(saved.note.rawText).toBe("просто набранная мысль");
    expect(saved.note.transcription).toBeNull();

    const row = await db.note.findUnique({
      where: { id: saved.note.id },
      select: { transcription: true },
    });
    expect(row?.transcription).toBeNull();

    await db.note.delete({ where: { id: saved.note.id } });
  });
});
