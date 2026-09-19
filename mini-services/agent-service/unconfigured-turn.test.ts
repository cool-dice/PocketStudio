import { afterAll, describe, expect, test } from "bun:test";

import { GatewayError } from "../../src/lib/ai/errors";
import { UNCONFIGURED_TOOL_MESSAGE } from "../../src/lib/ai/tools";
import { hashPassword } from "../../src/lib/auth";
import { db } from "../../src/lib/db";

import {
  replyIfAgentUnconfigured,
} from "./unconfigured-turn";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

const FAKE_SUCCESS =
  /готово|успешно|опубликовано|план выполнен|я обработал запрос/i;

describe.skipIf(SKIP_PG)("agent chat unconfigured fail-fast", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedThread(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `agent-unconf-${label}-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    const thread = await db.thread.create({
      data: { userId: user.id, title: "Новый диалог", mode: "ask" },
    });
    const userMessage = await db.message.create({
      data: {
        threadId: thread.id,
        role: "user",
        content: "Привет, запиши мысль про маяк",
      },
    });
    return { user, thread, userMessage };
  }

  test("mock unconfigured resolve persists UNCONFIGURED_TOOL_MESSAGE, not fake success", async () => {
    const { user, thread, userMessage } = await seedThread("noconfig");
    const started = Date.now();
    const reply = await replyIfAgentUnconfigured({
      db,
      userId: user.id,
      threadId: thread.id,
      resolve: async () => {
        throw new GatewayError(UNCONFIGURED_TOOL_MESSAGE, 400);
      },
    });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(reply).not.toBeNull();
    expect(reply?.role).toBe("assistant");
    expect(reply?.content).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(reply?.content).toMatch(/Администратор ещё не настроил/);
    expect(reply?.content).toMatch(/[А-Яа-яЁё]/);
    expect(reply?.content).not.toMatch(FAKE_SUCCESS);

    const rows = await db.message.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(userMessage.id);
    expect(rows[0]?.role).toBe("user");
    expect(rows[1]?.role).toBe("assistant");
    expect(rows[1]?.content).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(rows[1]?.content).not.toMatch(FAKE_SUCCESS);
  });

  test("configured resolve does not persist an assistant error", async () => {
    const { user, thread } = await seedThread("configured");
    const reply = await replyIfAgentUnconfigured({
      db,
      userId: user.id,
      threadId: thread.id,
      resolve: async () => ({ toolId: "agent" }),
    });
    expect(reply).toBeNull();
    expect(
      await db.message.count({
        where: { threadId: thread.id, role: "assistant" },
      }),
    ).toBe(0);
  });

  test("non-unconfigured resolve errors do not write a fake assistant", async () => {
    const { user, thread } = await seedThread("othererr");
    await expect(
      replyIfAgentUnconfigured({
        db,
        userId: user.id,
        threadId: thread.id,
        resolve: async () => {
          throw new GatewayError("Провайдер недоступен. Попробуйте позже", 502);
        },
      }),
    ).rejects.toBeInstanceOf(GatewayError);
    expect(
      await db.message.count({
        where: { threadId: thread.id, role: "assistant" },
      }),
    ).toBe(0);
  });
});
