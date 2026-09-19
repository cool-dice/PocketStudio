import type { Notification } from "@/lib/types";

export function reminderDedupeKey(noteId: string): string {
  return `reminder:${noteId}`;
}

export function sameBellItem(a: Notification, b: Notification): boolean {
  if (a.id === b.id) return true;
  if (a.dedupeKey && b.dedupeKey && a.dedupeKey === b.dedupeKey) return true;
  if (
    a.type === "reminder" &&
    b.type === "reminder" &&
    a.entityId &&
    a.entityId === b.entityId
  ) {
    return true;
  }
  return false;
}

/** Merge a bell item without double-counting unread on poll/WS echo. */
export function mergeNotification(
  list: Notification[],
  unread: number,
  incoming: Notification,
): { notifications: Notification[]; unread: number } {
  const existing = list.find((n) => sameBellItem(n, incoming));
  const notifications = [
    incoming,
    ...list.filter((n) => !sameBellItem(n, incoming)),
  ].slice(0, 50);
  if (!existing) {
    return {
      notifications,
      unread: incoming.read ? unread : unread + 1,
    };
  }
  let nextUnread = unread;
  if (!existing.read && incoming.read) nextUnread = Math.max(0, unread - 1);
  if (existing.read && !incoming.read) nextUnread = unread + 1;
  return { notifications, unread: nextUnread };
}
