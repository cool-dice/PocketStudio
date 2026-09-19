import { afterAll, describe, expect, test } from "bun:test";

import { GatewayError } from "../../src/lib/ai/errors";
import { UNCONFIGURED_TOOL_MESSAGE } from "../../src/lib/ai/tools";
import { hashPassword } from "../../src/lib/auth";
import { db as appDb } from "../../src/lib/db";
import { ANALYSIS_UNREADABLE_MESSAGE } from "../../src/lib/note-analysis";

import { analyzeNote } from "./analyzer";
import { db } from "./db-client";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

const validAnalysis = JSON.stringify({
  positive: "Образ маяка держит сцену.",
  negative: "Слишком много персонажей в одном кадре.",
  final: "Оставить смотрительницу и шторм.",
  recommendations: [
    "Написать первый кадр ночью",
    "Убрать второго героя",
    "Добавить звук прибоя",
  ],
  category_name: "Клипы",
  category_color: "emerald",
  category_icon: "lightbulb",
});

describe.skipIf(SKIP_PG)("analyzer honesty (tool id notes)", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await appDb.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedPending(label: string, extra?: { positiveBlock?: string }) {
    const user = await appDb.user.create({
      data: {
        name: label,
        email: `analyzer-${label}-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    const note = await db.note.create({
      data: {
        userId: user.id,
        rawText: "Мысль про маяк и шторм",
        status: "pending",
        positiveBlock: extra?.positiveBlock ?? null,
      },
    });
    return { user, note };
  }

  test("unconfigured generate writes error status, not fake 4-block JSON", async () => {
    const { note } = await seedPending("noconfig", {
      positiveBlock: "не должно остаться",
    });
    await analyzeNote(note.id, async () => {
      throw new GatewayError(UNCONFIGURED_TOOL_MESSAGE, 400);
    });
    const row = await db.note.findUnique({ where: { id: note.id } });
    expect(row?.status).toBe("error");
    expect(row?.errorMessage).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(row?.positiveBlock).toBeNull();
    expect(row?.negativeBlock).toBeNull();
    expect(row?.finalBlock).toBeNull();
    expect(row?.recommendations).toBeNull();
    expect(row?.analyzedAt).toBeNull();
  });

  test("failed LLM does not invent positive/negative/final", async () => {
    const { note } = await seedPending("fail");
    await analyzeNote(note.id, async () => {
      throw new GatewayError("Провайдер недоступен. Попробуйте позже", 502);
    });
    const row = await db.note.findUnique({ where: { id: note.id } });
    expect(row?.status).toBe("error");
    expect(row?.errorMessage).toMatch(/не удался|недоступен/i);
    expect(row?.positiveBlock).toBeNull();
    expect(row?.negativeBlock).toBeNull();
    expect(row?.finalBlock).toBeNull();
    expect(row?.recommendations).toBeNull();
  });

  test("unreadable JSON is an error, not filler blocks", async () => {
    const { note } = await seedPending("garbage");
    await analyzeNote(note.id, async () => "это не JSON анализа");
    const row = await db.note.findUnique({ where: { id: note.id } });
    expect(row?.status).toBe("error");
    expect(row?.errorMessage).toMatch(ANALYSIS_UNREADABLE_MESSAGE);
    expect(row?.positiveBlock).toBeNull();
    expect(row?.negativeBlock).toBeNull();
    expect(row?.finalBlock).toBeNull();
  });

  test("success persists four blocks and they survive a reload", async () => {
    const { note } = await seedPending("ok");
    await analyzeNote(note.id, async () => validAnalysis);
    const row = await db.note.findUnique({ where: { id: note.id } });
    expect(row?.status).toBe("processed");
    expect(row?.positiveBlock).toMatch(/маяк/i);
    expect(row?.negativeBlock).toMatch(/персонаж/i);
    expect(row?.finalBlock).toMatch(/смотрительниц/i);
    expect(JSON.parse(row?.recommendations ?? "[]")).toHaveLength(3);
    expect(row?.errorMessage).toBeNull();
    expect(row?.analyzedAt).toBeInstanceOf(Date);

    const reload = await db.note.findUnique({ where: { id: note.id } });
    expect(reload?.positiveBlock).toBe(row?.positiveBlock);
    expect(reload?.finalBlock).toBe(row?.finalBlock);
    expect(reload?.recommendations).toBe(row?.recommendations);
  });
});
