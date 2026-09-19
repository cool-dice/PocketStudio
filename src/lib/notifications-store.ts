"use client";

/**
 * Notifications store (zustand) — the bell state.
 *
 * Populated from two sources:
 *  - REST (api.listNotifications) — initial load + reconnect resync
 *    (triggered from the socket provider on "connect");
 *  - WS "notification:new" — live push from the agent-service.
 *
 * Mutations (mark read / mark all / clear) update the local state first and
 * fire the REST call in the background — the bell must feel instant.
 *
 * Why a store and not a hook: the sidebar renders twice (desktop aside +
 * mobile Sheet) and the socket provider must be able to push updates from
 * outside React — same reasoning as useAppUi.
 */

import { create } from "zustand";

import { mergeNotification } from "@/lib/notification-merge";
import type { Notification } from "@/lib/types";

interface NotificationsState {
  notifications: Notification[];
  unread: number;
  /** At least one successful REST/WS sync has happened. */
  loaded: boolean;
  /** Incremented on every change → subscribers (bell) re-render. */
  version: number;

  /** Full resync from the REST API (initial load, reconnect, popover open). */
  refresh: () => Promise<void>;
  /** Live WS push — prepend + bump the unread badge. */
  prepend: (notification: Notification) => void;
  /** Single mark-read (idempotent). */
  markRead: (id: string) => void;
  /** Mark everything read (REST + local). */
  markAllRead: () => Promise<void>;
  /** Clear the whole history (REST + local). */
  clearAll: () => Promise<void>;
}

export const useNotifications = create<NotificationsState>((set, get) => ({
  notifications: [],
  unread: 0,
  loaded: false,
  version: 0,

  refresh: async () => {
    try {
      const { notifications, unread } = await api.listNotifications();
      set((s) => ({ notifications, unread, loaded: true, version: s.version + 1 }));
    } catch {
      // keep the previous state — a later refresh will resync
    }
  },

  prepend: (notification) => {
    set((s) => {
      const next = mergeNotification(s.notifications, s.unread, notification);
      return {
        notifications: next.notifications,
        unread: next.unread,
        loaded: true,
        version: s.version + 1,
      };
    });
  },

  markRead: (id) => {
    const target = get().notifications.find((n) => n.id === id);
    if (!target || target.read) return;
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
      unread: Math.max(0, s.unread - 1),
      version: s.version + 1,
    }));
    void api.markNotificationRead(id).catch(() => {
      // The next refresh resyncs; the UI already feels instant.
    });
  },

  markAllRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unread: 0,
      version: s.version + 1,
    }));
    try {
      await api.markAllNotificationsRead();
    } catch {
      // local state already updated; refresh will resync
    }
  },

  clearAll: async () => {
    set((s) => ({ notifications: [], unread: 0, version: s.version + 1 }));
    try {
      await api.clearNotifications();
    } catch {
      // local state already updated; refresh will resync
    }
  },
}));
