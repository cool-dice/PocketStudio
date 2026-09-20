import { afterEach, describe, expect, test } from "bun:test";

import { BELL_LOAD_ERROR } from "./notification-copy";
import { useNotifications } from "./notifications-store";
import type { Notification } from "./types";

function sample(id = "n1"): Notification {
  return {
    id,
    type: "system",
    title: "Система",
    body: "тест",
    entityId: null,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

afterEach(() => {
  useNotifications.setState({
    notifications: [],
    unread: 0,
    loaded: false,
    loadError: null,
    version: 0,
  });
});

describe("notifications store", () => {
  test("refresh loads the bell via api.listNotifications", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ notifications: [sample()], unread: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    try {
      await useNotifications.getState().refresh();
      const s = useNotifications.getState();
      expect(s.loaded).toBe(true);
      expect(s.loadError).toBeNull();
      expect(s.unread).toBe(1);
      expect(s.notifications.map((n) => n.id)).toEqual(["n1"]);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("successful empty list is empty, not a load error", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ notifications: [], unread: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    try {
      await useNotifications.getState().refresh();
      const s = useNotifications.getState();
      expect(s.loaded).toBe(true);
      expect(s.loadError).toBeNull();
      expect(s.notifications).toEqual([]);
      expect(s.unread).toBe(0);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("failed list is a load error, not an empty bell", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: "offline" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    try {
      await useNotifications.getState().refresh();
      const s = useNotifications.getState();
      expect(s.loaded).toBe(false);
      expect(s.loadError).toBe(BELL_LOAD_ERROR);
      expect(s.notifications).toEqual([]);
      expect(s.loadError).not.toMatch(/пока тихо/i);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("markRead does not throw and PATCHes /api/notifications/:id", async () => {
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(
        JSON.stringify({ notification: { ...sample(), read: true } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;
    try {
      useNotifications.getState().prepend(sample());
      expect(() => useNotifications.getState().markRead("n1")).not.toThrow();
      expect(useNotifications.getState().unread).toBe(0);
      await new Promise((r) => setTimeout(r, 20));
      expect(
        calls.some(
          (c) => c.startsWith("PATCH") && c.includes("/api/notifications/n1"),
        ),
      ).toBe(true);
    } finally {
      globalThis.fetch = orig;
    }
  });

  test("markAllRead POSTs /api/notifications/read-all and clears the badge", async () => {
    const calls: string[] = [];
    const orig = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      useNotifications.getState().prepend(sample("n1"));
      useNotifications.getState().prepend(sample("n2"));
      expect(useNotifications.getState().unread).toBe(2);
      await useNotifications.getState().markAllRead();
      const s = useNotifications.getState();
      expect(s.unread).toBe(0);
      expect(s.notifications.every((n) => n.read)).toBe(true);
      expect(
        calls.some(
          (c) => c.startsWith("POST") && c.includes("/api/notifications/read-all"),
        ),
      ).toBe(true);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
