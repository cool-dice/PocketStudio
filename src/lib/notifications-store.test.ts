import { afterEach, describe, expect, test } from "bun:test";

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
      expect(s.unread).toBe(1);
      expect(s.notifications.map((n) => n.id)).toEqual(["n1"]);
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
});
