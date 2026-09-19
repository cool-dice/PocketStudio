import { describe, expect, test } from "bun:test";

import { mergeNotification, reminderDedupeKey } from "./notification-merge";
import type { Notification } from "@/lib/types";

function n(
  id: string,
  opts: Partial<Notification> = {},
): Notification {
  return {
    id,
    type: "reminder",
    title: "Напоминание",
    body: "маяк",
    entityId: "note-1",
    read: false,
    createdAt: new Date().toISOString(),
    ...opts,
  };
}

describe("mergeNotification", () => {
  test("prepends a fresh unread item and bumps the badge", () => {
    const next = mergeNotification([], 0, n("a"));
    expect(next.notifications.map((x) => x.id)).toEqual(["a"]);
    expect(next.unread).toBe(1);
  });

  test("echo of the same id does not spawn a duplicate or bump unread", () => {
    const first = n("a");
    const seeded = mergeNotification([], 0, first);
    const echoed = mergeNotification(seeded.notifications, seeded.unread, first);
    expect(echoed.notifications).toHaveLength(1);
    expect(echoed.unread).toBe(1);
  });

  test("reminder dedupe key is stable per note, not per poll", () => {
    expect(reminderDedupeKey("note-1")).toBe("reminder:note-1");
    expect(reminderDedupeKey("note-1")).toBe(reminderDedupeKey("note-1"));
    expect(reminderDedupeKey("note-2")).not.toBe(reminderDedupeKey("note-1"));
  });

  test("marking an existing item read decrements unread", () => {
    const seeded = mergeNotification([], 0, n("a"));
    const next = mergeNotification(
      seeded.notifications,
      seeded.unread,
      n("a", { read: true }),
    );
    expect(next.unread).toBe(0);
  });
});
