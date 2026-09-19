"use client";

/**
 * Poll due note reminders and surface them in the bell + a toast.
 * Fires at most once per note (server idempotency via Notification.entityId).
 */

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAppUi } from "@/lib/store";

const INTERVAL_MS = 45_000;

export function DueRemindersWatcher() {
  const bumpNotes = useAppUi((s) => s.bumpNotes);
  const setMainArea = useAppUi((s) => s.setMainArea);
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
        for (const note of res.notes.slice(0, 3)) {
          toast("Напоминание", {
            description: note.preview,
            action: {
              label: "Блокнот",
              onClick: () => setMainArea("notebook"),
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
  }, [bumpNotes, setMainArea]);

  return null;
}
