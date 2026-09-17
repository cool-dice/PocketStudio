"use client";

/**
 * SocketProvider — socket.io connection to the agent-service
 * (mini-services/agent-service, port 3003, engine path "/") through the
 * sandbox gateway: io("/?XTransformPort=3003").
 *
 * The provider is mounted only for authenticated users and is keyed by
 * user id (see src/app/page.tsx), so the socket lives exactly one session.
 * Auth: the `auth` handshake callback fetches a short-lived ws-token
 * (GET /api/auth/ws-token, aud "ws", 60s TTL) on every connection attempt,
 * so reconnections always carry a fresh token. On an auth failure the
 * connection is retried once (the server calls disconnect(true) which
 * disables automatic reconnection).
 *
 * Stage 2 note pipeline: the analyzer worker emits "note:analyzing" /
 * "note:analyzed" to the user room (no thread:join needed). These are
 * handled here once per connection — the open context note is patched
 * through the store, a deduped toast is fired, and consumers (use-notes
 * patches the notebook feed) can subscribe via `onNoteEvent`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { textPreview } from "@/lib/format";
import { useAppUi } from "@/lib/store";
import type {
  Note,
  WsNoteAnalyzedPayload,
  WsNoteAnalyzingPayload,
  WsProjectCreatedPayload,
  WsProjectUpdatedPayload,
} from "@/lib/types";

/** Live note-analysis pipeline events forwarded to onNoteEvent subscribers. */
export type NoteEvent =
  | { type: "note:analyzing"; noteId: string }
  | { type: "note:analyzed"; note: Note };

type NoteEventListener = (event: NoteEvent) => void;

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  /** Make sure the socket is connected. Resolves false on timeout. */
  ensureConnected: () => Promise<boolean>;
  /**
   * Subscribe to note pipeline events (note:analyzing / note:analyzed).
   * Returns an unsubscribe function. Listeners run inside socket handlers
   * and must stay cheap and never throw.
   */
  onNoteEvent: (listener: NoteEventListener) => () => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  ensureConnected: async () => false,
  onNoteEvent: () => () => {},
});

const AUTH_ERROR = "Не авторизован";

export function SocketProvider({ children }: { children: ReactNode }) {
  // External resource created once per provider lifetime. With
  // autoConnect:false the constructor is inert until .connect() is called
  // (io() reuses the same instance for identical url+namespace, so React
  // StrictMode double-invocation is harmless). The auth callback fetches a
  // fresh ws-token on every connect attempt.
  const [socket] = useState<Socket>(() =>
    io("/?XTransformPort=3003", {
      path: "/",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: false,
      auth: (cb) => {
        api
          .wsToken()
          .then(({ token }) => cb({ token }))
          .catch(() => cb({}));
      },
    }),
  );

  const [connected, setConnected] = useState(false);
  const authRetryRef = useRef(false);
  const disposedRef = useRef(false);

  // Note pipeline listener registry (use-notes subscribes to patch the
  // notebook feed in place). Kept in a ref so onNoteEvent stays stable.
  const noteListenersRef = useRef(new Set<NoteEventListener>());

  const onNoteEvent = useCallback((listener: NoteEventListener) => {
    noteListenersRef.current.add(listener);
    return () => {
      noteListenersRef.current.delete(listener);
    };
  }, []);

  useEffect(() => {
    disposedRef.current = false;
    const s = socket;

    const handleConnect = () => {
      authRetryRef.current = false;
      setConnected(true);
      // Reconnect resync: if the socket dropped while the open note was
      // mid-analysis (e.g. the service was reaped and self-healed), a
      // terminal event may have been missed — refetch the open note so it
      // never gets stuck on «Анализируем…».
      const ui = useAppUi.getState();
      const open = ui.contextNote;
      if (
        open &&
        (open.status === "pending" || open.status === "processing")
      ) {
        void ui.refreshNote();
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    // Server emits "error" {message: "Не авторизован"} and disconnect(true)
    // on handshake failure — retry once (the next connect attempt fetches
    // a fresh token via the auth callback).
    const retryOnce = () => {
      if (authRetryRef.current || disposedRef.current) return;
      authRetryRef.current = true;
      s.connect();
    };

    const handleServerError = (payload: unknown) => {
      const message =
        (payload as { message?: unknown } | null)?.message ?? "";
      if (message === AUTH_ERROR) {
        retryOnce();
      }
    };

    const handleConnectError = (err: Error) => {
      setConnected(false);
      if (err.message.includes(AUTH_ERROR)) {
        retryOnce();
        return;
      }
      // The agent-service mini-service may have been reaped by the sandbox —
      // ask the Next.js app to respawn its supervisor (self-healing), then
      // let socket.io's automatic reconnection do the rest.
      void healAgentService();
    };

    // Debounced self-heal: at most one POST per 30s per provider lifetime.
    const healRef = { last: 0 };
    async function healAgentService() {
      if (disposedRef.current) return;
      const now = Date.now();
      if (now - healRef.last < 30000) return;
      healRef.last = now;
      try {
        await fetch("/api/health/agent-service", { method: "POST" });
      } catch {
        // Next app unreachable — nothing we can do from here
      }
    }

    /* ── Note analysis pipeline (Stage 2) ── */

    const emitNoteEvent = (event: NoteEvent) => {
      noteListenersRef.current.forEach((listener) => {
        listener(event);
      });
    };

    // Toast dedupe: at most one toast per note per minute (retries and
    // socket echoes must never spam duplicates).
    const noteToastAt = new Map<string, number>();

    const handleNoteAnalyzing = (payload: unknown) => {
      const { noteId } = (payload ?? {}) as WsNoteAnalyzingPayload;
      if (typeof noteId !== "string") return;
      emitNoteEvent({ type: "note:analyzing", noteId });
      const ui = useAppUi.getState();
      const open = ui.contextNote;
      if (open?.id === noteId && open.status === "pending") {
        ui.updateContextNote({ ...open, status: "processing" });
      }
    };

    const notifyAnalyzed = (note: Note) => {
      const now = Date.now();
      if (now - (noteToastAt.get(note.id) ?? 0) < 60_000) return;
      noteToastAt.set(note.id, now);
      if (noteToastAt.size > 200) {
        for (const [id, at] of noteToastAt) {
          if (now - at > 60_000) noteToastAt.delete(id);
        }
      }
      const description = textPreview(note.rawText, 80) || undefined;
      const openAction = {
        label: "Открыть",
        onClick: () => useAppUi.getState().openNote(note),
      };
      if (note.status === "error") {
        toast.error("Не удалось проанализировать заметку", {
          description,
          action: openAction,
        });
        return;
      }
      toast.success("Анализ заметки готов", {
        description,
        action: openAction,
      });
    };

    const handleNoteAnalyzed = (payload: unknown) => {
      const { note } = (payload ?? {}) as WsNoteAnalyzedPayload;
      if (!note || typeof note.id !== "string") return;
      emitNoteEvent({ type: "note:analyzed", note });
      const ui = useAppUi.getState();
      ui.updateContextNote(note);
      notifyAnalyzed(note);
    };

    /* ── Project events (Stage 3) ── */

    const handleProjectCreated = (payload: unknown) => {
      const { project } = (payload ?? {}) as WsProjectCreatedPayload;
      if (!project || typeof project.id !== "string") return;
      useAppUi.getState().bumpProjects();
      toast.success(`Агент создал проект «${project.name}»`, {
        action: {
          label: "Открыть",
          onClick: () => useAppUi.getState().openProject(project.id),
        },
      });
    };

    // File updates are frequent → silent bump; checkpoints toast (deduped
    // per project for 60s so socket echoes never double-fire).
    const checkpointToastAt = new Map<string, number>();
    const handleProjectUpdated = (payload: unknown) => {
      const { projectId, reason } = (payload ?? {}) as WsProjectUpdatedPayload;
      if (typeof projectId !== "string") return;
      const ui = useAppUi.getState();
      if (ui.activeProjectId !== projectId) return;
      ui.bumpProjectFiles();
      if (reason === "checkpoint") {
        const now = Date.now();
        if (now - (checkpointToastAt.get(projectId) ?? 0) < 60_000) return;
        checkpointToastAt.set(projectId, now);
        toast.success("Агент сделал чекпоинт");
      }
    };

    s.on("connect", handleConnect);
    s.on("disconnect", handleDisconnect);
    s.on("connect_error", handleConnectError);
    s.on("error", handleServerError);
    s.on("note:analyzing", handleNoteAnalyzing);
    s.on("note:analyzed", handleNoteAnalyzed);
    s.on("project:created", handleProjectCreated);
    s.on("project:updated", handleProjectUpdated);

    s.connect();

    return () => {
      disposedRef.current = true;
      // Removes the auth/connect/self-heal and note pipeline handlers.
      s.removeAllListeners();
      s.disconnect();
    };
  }, [socket]);

  const ensureConnected = useCallback(async (): Promise<boolean> => {
    const s = socket;
    if (s.connected) return true;

    if (s.disconnected) s.connect();

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 8000);
      const onConnect = () => {
        cleanup();
        resolve(true);
      };
      const cleanup = () => {
        clearTimeout(timeout);
        s.off("connect", onConnect);
      };
      s.on("connect", onConnect);
    });
  }, [socket]);

  return (
    <SocketContext.Provider
      value={{ socket, connected, ensureConnected, onNoteEvent }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within <SocketProvider>");
  }
  return ctx;
}
