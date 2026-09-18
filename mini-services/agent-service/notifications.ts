// PocketStudio notifications — persisted bell history.
//
// The agent-service creates a Notification row whenever something meaningful
// happens OUTSIDE the user's current focus (the analysis pipeline finishing
// ~30–60s after a capture, the agent creating a project, an auto-checkpoint)
// and emits "notification:new" {notification} to the user room. The Next.js
// REST API (/api/notifications) serves the list / read / clear operations;
// the frontend keeps a zustand store synced through the socket provider.
//
// Toasts for the same events keep firing from their own WS handlers
// (note:analyzed / project:created / project:updated) — a notification is
// the PERSISTENT trace, not a second toast.
//
// Retention: the newest MAX_NOTIFICATIONS rows per user are kept (older
// rows are deleted best-effort — the bell is history, not an archive).

import type { Server } from "socket.io";
import { db } from "./db-client";

const MAX_NOTIFICATIONS = 100;
const MAX_TITLE_CHARS = 120;
const MAX_BODY_CHARS = 300;

export type NotificationType =
  | "analysis_ready"
  | "project_created"
  | "checkpoint"
  | "system";

/** Wire shape — mirrors src/lib/types.ts Notification (ISO date). */
function serialize(n: {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    entityId: n.entityId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

/**
 * Persist a notification + emit "notification:new" to the user room.
 * Never throws — a failed notification must never break the pipeline/turn
 * that triggered it.
 */
export async function createNotification(
  io: Server,
  userId: string,
  type: NotificationType,
  title: string,
  body?: string | null,
  entityId?: string | null,
): Promise<void> {
  try {
    const created = await db.notification.create({
      data: {
        userId,
        type,
        title: title.trim().slice(0, MAX_TITLE_CHARS),
        body: body ? body.trim().slice(0, MAX_BODY_CHARS) : null,
        entityId: entityId ?? null,
      },
    });
    io.to(`user:${userId}`).emit("notification:new", {
      notification: serialize(created),
    });

    // Best-effort retention trim (never blocks the caller).
    void (async () => {
      try {
        const count = await db.notification.count({ where: { userId } });
        if (count > MAX_NOTIFICATIONS) {
          const oldest = await db.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
            take: count - MAX_NOTIFICATIONS,
            select: { id: true },
          });
          await db.notification.deleteMany({
            where: { id: { in: oldest.map((n) => n.id) } },
          });
        }
      } catch {
        // retention is best-effort
      }
    })();
  } catch (err) {
    console.warn(
      `[notifications] create failed (ignored):`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
