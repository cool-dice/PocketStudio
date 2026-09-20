"use client";

/**
 * Poll due note reminders and surface them in the bell + a toast.
 * Fires at most once per note (server idempotency via Notification.entityId).
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import {
  reminderToastId,
  shouldToastNewReminder,
} from "@/lib/notification-copy";
import { useNotifications } from "@/lib/notifications-store";
import { useAppUi } from "@/lib/store";

const INTERVAL_MS = 45_000;

export function DueRemindersWatcher() {
  const bumpNotes = useAppUi((s) => s.bumpNotes);
  const setMainArea = useAppUi((s) => s.setMainArea);
  const openNote = useAppUi((s) => s.openNote);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (inFlight.current || document.visibilityState === "hidden") return;
      inFlight.current = true;
      try {
        const res = await api.fireDueReminders();
        if (cancelled || !res.fired) return;
        bumpNotes();
        const store = useNotifications.getState();
        for (const note of res.notes) {
          if (note.notification) store.prepend(note.notification);
        }
        if (!res.notes.some((n) => n.notification)) {
          void store.refresh();
        }
        for (const note of res.notes.slice(0, 3)) {
          if (!shouldToastNewReminder("poll")) continue;
          toast("Напоминание", {
            id: reminderToastId(note.id),
            description: note.preview,
            action: {
              label: "Открыть",
              onClick: () => {
                if (note.notification) {
                  useNotifications.getState().markRead(note.notification.id);
                }
                void api
                  .getNote(note.id)
                  .then((full) => {
                    openNote(full);
                    setMainArea("notebook");
                  })
                  .catch(() => setMainArea("notebook"));
              },
            },
          });
        }
      } catch {
        // offline / 401 — next tick
      } finally {
        inFlight.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), INTERVAL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bumpNotes, setMainArea, openNote]);

  return null;
}
