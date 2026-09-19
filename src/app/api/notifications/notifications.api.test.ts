import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as listNotifications, DELETE as clearNotifications } from "./route";
import { PATCH as patchNotification } from "./[id]/route";
import { POST as markAllRead } from "./read-all/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

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

describe.skipIf(SKIP_PG)("notifications API: mark-all-read, empty vs error, IDOR", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `bell-${label}-${stamp}@example.test`,
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

  test("401 without a session", async () => {
    const list = await listNotifications(
      jsonRequest("http://localhost/api/notifications", "GET"),
    );
    expect(list.status).toBe(401);

    const all = await markAllRead(
      jsonRequest("http://localhost/api/notifications/read-all", "POST", {}),
    );
    expect(all.status).toBe(401);
  });

  test("successful empty list is [] — not an error payload", async () => {
    const { token } = await seedUser("empty");
    const res = await listNotifications(
      jsonRequest("http://localhost/api/notifications", "GET", undefined, token),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      notifications: unknown[];
      unread: number;
      error?: string;
    };
    expect(json.error).toBeUndefined();
    expect(json.notifications).toEqual([]);
    expect(json.unread).toBe(0);
    expect(JSON.stringify(json)).not.toMatch(/пока тихо|не удалось/i);
  });

  test("POST /read-all marks only this user's unread rows", async () => {
    const { user, token } = await seedUser("owner");
    const { user: other, token: otherToken } = await seedUser("other");

    const mineA = await db.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Моё А",
        body: "маяк",
      },
    });
    const mineB = await db.notification.create({
      data: {
        userId: user.id,
        type: "reminder",
        title: "Моё Б",
        body: "напомнить",
      },
    });
    const theirs = await db.notification.create({
      data: {
        userId: other.id,
        type: "system",
        title: "Чужое",
        body: "секрет",
      },
    });

    const marked = await markAllRead(
      jsonRequest(
        "http://localhost/api/notifications/read-all",
        "POST",
        {},
        token,
      ),
    );
    expect(marked.status).toBe(200);
    const markedJson = (await marked.json()) as { ok: boolean };
    expect(markedJson.ok).toBe(true);

    const mineAfter = await db.notification.findMany({
      where: { id: { in: [mineA.id, mineB.id] } },
    });
    expect(mineAfter.every((n) => n.read)).toBe(true);

    const theirsAfter = await db.notification.findUnique({
      where: { id: theirs.id },
    });
    expect(theirsAfter?.read).toBe(false);

    const list = await listNotifications(
      jsonRequest("http://localhost/api/notifications", "GET", undefined, token),
    );
    expect(list.status).toBe(200);
    const listJson = (await list.json()) as {
      notifications: { id: string; read: boolean; title: string }[];
      unread: number;
    };
    expect(listJson.unread).toBe(0);
    expect(listJson.notifications.map((n) => n.id).sort()).toEqual(
      [mineA.id, mineB.id].sort(),
    );
    expect(listJson.notifications.every((n) => n.read)).toBe(true);
    expect(JSON.stringify(listJson)).not.toContain("Чужое");
    expect(JSON.stringify(listJson)).not.toContain(theirs.id);

    const otherList = await listNotifications(
      jsonRequest(
        "http://localhost/api/notifications",
        "GET",
        undefined,
        otherToken,
      ),
    );
    const otherJson = (await otherList.json()) as {
      notifications: { id: string; read: boolean }[];
      unread: number;
    };
    expect(otherJson.unread).toBe(1);
    expect(otherJson.notifications.some((n) => n.id === theirs.id && !n.read)).toBe(
      true,
    );
  });

  test("PATCH and DELETE of another user's notification are 404 / no wipe", async () => {
    const { token: attacker } = await seedUser("atk");
    const { user: owner } = await seedUser("victim");
    const row = await db.notification.create({
      data: {
        userId: owner.id,
        type: "system",
        title: "Секрет колокола",
        body: "не для чужих",
        read: false,
      },
    });

    const patched = await patchNotification(
      jsonRequest(
        `http://localhost/api/notifications/${row.id}`,
        "PATCH",
        { read: true },
        attacker,
      ),
      { params: Promise.resolve({ id: row.id }) },
    );
    expect(patched.status).toBe(404);
    const patchedJson = (await patched.json()) as {
      error: string;
      notification?: unknown;
    };
    expect(patchedJson.notification).toBeUndefined();
    expect(patchedJson.error).toMatch(/не найден/i);

    const still = await db.notification.findUnique({ where: { id: row.id } });
    expect(still?.read).toBe(false);
    expect(still?.title).toBe("Секрет колокола");

    const cleared = await clearNotifications(
      jsonRequest("http://localhost/api/notifications", "DELETE", undefined, attacker),
    );
    expect(cleared.status).toBe(200);
    const leftover = await db.notification.findUnique({ where: { id: row.id } });
    expect(leftover?.id).toBe(row.id);
  });
});
