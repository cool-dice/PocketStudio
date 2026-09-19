"use client";

/**
 * ThreadsProvider — thread list + active thread messages, REST actions and
 * live WS subscriptions (agent-service :3003).
 *
 * Flow: optimistic user message → "message:user" replaces it →
 * "agent:thinking" → "message:start" adds an empty assistant bubble →
 * "message:delta"× appends → "message:end" finalizes. "thread:updated"
 * renames in the list (auto-title), "error" → toast + busy-state cleanup.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import {
  isEmptyAssistantBubble,
  shouldBlockSend,
  shouldKeepBusyOnSocketError,
} from "@/lib/chat-send-guard";
import type {
  ChatMessage,
  Message,
  Note,
  NoteStatus,
  Task,
  ThreadListItem,
  ThreadMode,
  TurnPhase,
  WsAgentThinkingPayload,
  WsErrorPayload,
  WsMessageDeltaPayload,
  WsMessageEndPayload,
  WsMessageStartPayload,
  WsMessageUserPayload,
  WsTasksUpdatedPayload,
  WsThreadUpdatedPayload,
  WsToolEndPayload,
  WsToolStartPayload,
  WsTurnPhasePayload,
  WsCanonPrefetchPayload,
} from "@/lib/types";
import { useSocket } from "@/hooks/use-socket";

interface ThreadsContextValue {
  threads: ThreadListItem[];
  threadsLoading: boolean;
  activeThreadId: string | null;
  activeThread: ThreadListItem | null;
  messages: ChatMessage[];
  messagesLoading: boolean;
  /** Agent is thinking or streaming in the active thread — composer disabled. */
  busy: boolean;
  /** "agent:thinking" received for the active thread (before the bubble appears). */
  thinking: boolean;
  /** Orchestrator phase for the active thread (plan/act/review) + label. */
  phase: { phase: TurnPhase; label: string | null } | null;
  /** Plan checklist of the active thread (live via "tasks:updated"). */
  tasks: Task[];
  selectThread: (id: string) => Promise<void>;
  newThread: () => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  renameThread: (id: string, title: string) => Promise<void>;
  /** Switch the thread mode (ask/plan/act/review) — optimistic + PATCH. */
  updateThreadMode: (id: string, mode: ThreadMode) => Promise<void>;
  /**
   * Create a new thread bound to a project («Обсудить проект») and make it
   * active. Returns the thread or null on failure.
   */
  startProjectThread: (projectId: string, title: string) => Promise<boolean>;
  sendMessage: (content: string) => Promise<void>;
  abortTurn: () => void;
  /** Short RAG hint after prefetch (not the chunks themselves). */
  canonHint: { scope: "studio" | "workspace"; hitCount: number } | null;
}

const ThreadsContext = createContext<ThreadsContextValue | null>(null);

function tempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normalize an agent tool result (create_note / open_note) into a Note for
 * the context panel. create_note nests the note under result.note with a
 * sibling result.category; open_note returns the note itself.
 */
function noteFromToolResult(tool: string, result: unknown): Note | null {
  if (typeof result !== "object" || result === null) return null;
  const r = result as Record<string, unknown>;
  const raw = tool === "create_note" ? r.note : r;
  if (typeof raw !== "object" || raw === null) return null;
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== "string") return null;

  const cat = (tool === "create_note" ? r.category : n.category) as
    | Record<string, unknown>
    | null
    | undefined;

  return {
    id: n.id,
    rawText: typeof n.rawText === "string" ? n.rawText : null,
    status: (typeof n.status === "string" ? n.status : "pending") as NoteStatus,
    favorite: typeof n.favorite === "boolean" ? n.favorite : false,
    // 4-блочный анализ в превью сайдбара не показывается (поля — null).
    positive: null,
    negative: null,
    final: null,
    recommendations: null,
    analyzedAt: null,
    createdAt:
      typeof n.createdAt === "string"
        ? n.createdAt
        : new Date().toISOString(),
    category:
      cat && typeof cat === "object" && typeof cat.id === "string"
        ? {
            id: String(cat.id),
            name: String(cat.name ?? ""),
            color: String(cat.color ?? "stone"),
            icon: String(cat.icon ?? "lightbulb"),
          }
        : null,
  };
}

export function ThreadsProvider({ children }: { children: ReactNode }) {
  const { socket, ensureConnected } = useSocket();

  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [thinkingThreadId, setThinkingThreadId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [phase, setPhase] = useState<{
    threadId: string;
    phase: TurnPhase;
    label: string | null;
  } | null>(null);
  const [streaming, setStreaming] = useState<{
    threadId: string;
    messageId: string;
  } | null>(null);
  const [canonHint, setCanonHint] = useState<{
    scope: "studio" | "workspace";
    hitCount: number;
  } | null>(null);

  // Refs mirror state so WS handlers and callbacks always see fresh values.
  const socketRef = useRef(socket);
  const activeIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const threadsRef = useRef<ThreadListItem[]>([]);
  const streamingRef = useRef<typeof streaming>(null);
  /** Thread whose messages finished loading — required for safe empty-thread cleanup. */
  const loadedRef = useRef<string | null>(null);
  const selectSeqRef = useRef(0);
  const sendLockRef = useRef(false);
  const abortingRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);
  useEffect(() => {
    activeIdRef.current = activeThreadId;
  }, [activeThreadId]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  /** Update list preview and move the thread to the top (most recently active). */
  const bumpThread = useCallback((threadId: string, message: Message) => {
    setThreads((prev) => {
      const idx = prev.findIndex((t) => t.id === threadId);
      if (idx === -1) return prev;
      const copy = [...prev];
      const item: ThreadListItem = {
        ...copy[idx],
        updatedAt: message.createdAt,
        lastMessage: {
          content: message.content,
          // Превью сайдбара показывает только текстовые роли пользователя/студии.
          role: message.role === "user" ? "user" : "assistant",
          createdAt: message.createdAt,
        },
      };
      copy.splice(idx, 1);
      copy.unshift(item);
      return copy;
    });
  }, []);

  /** Silently delete an empty thread when the user switches away from it. */
  const maybeDeleteEmptyThread = useCallback(async (threadId: string) => {
    // Only delete when messages were fully loaded and the thread is truly empty
    // (no optimistic or streaming messages either).
    if (loadedRef.current !== threadId) return;
    if (messagesRef.current.length > 0) return;
    if (streamingRef.current?.threadId === threadId) return;
    try {
      await api.deleteThread(threadId);
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
    } catch {
      // Keep the thread if the request fails — harmless.
    }
  }, []);

  const emitLeave = useCallback((threadId: string) => {
    const s = socketRef.current;
    if (s && s.connected) s.emit("thread:leave", { threadId });
  }, []);

  const selectThreadInternal = useCallback(
    async (id: string, opts?: { skipCleanup?: boolean }) => {
      const prevId = activeIdRef.current;
      if (prevId === id) return;

      if (prevId && !opts?.skipCleanup) {
        await maybeDeleteEmptyThread(prevId);
      }
      if (prevId) emitLeave(prevId);

      const seq = ++selectSeqRef.current;
      loadedRef.current = null;
      activeIdRef.current = id;
      setActiveThreadId(id);
      setMessages([]);
      setTasks([]);
      setPhase(null);
      setMessagesLoading(true);

      try {
        const [{ thread, messages: loaded }, tasksRes] = await Promise.all([
          api.getThread(id),
          api.getThreadTasks(id).catch(() => ({ tasks: [] as Task[] })),
        ]);
        if (seq !== selectSeqRef.current) return; // stale response
        setThreads((prev) => {
          const idx = prev.findIndex((t) => t.id === id);
          if (idx === -1) return prev;
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...thread };
          return copy;
        });
        loadedRef.current = id;
        setMessages(loaded.map((m) => ({ ...m })));
        setTasks(tasksRes.tasks);
        setCanonHint(null);
        const s = socketRef.current;
        if (s && s.connected) s.emit("thread:join", { threadId: id });
      } catch {
        if (seq === selectSeqRef.current) {
          toast.error("Не удалось загрузить диалог");
        }
      } finally {
        if (seq === selectSeqRef.current) {
          setMessagesLoading(false);
        }
      }
    },
    [emitLeave, maybeDeleteEmptyThread],
  );

  // Keep a stable ref to the latest selector for the one-shot initial load.
  const selectRef = useRef(selectThreadInternal);
  useEffect(() => {
    selectRef.current = selectThreadInternal;
  });

  // Initial load: thread list + auto-select the most recent thread.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listThreads();
        if (cancelled) return;
        setThreads(list);
        if (list.length > 0) {
          await selectRef.current(list[0].id, { skipCleanup: true });
        }
      } catch {
        if (!cancelled) toast.error("Не удалось загрузить список диалогов");
      } finally {
        if (!cancelled) setThreadsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectThread = useCallback(
    async (id: string) => {
      await selectThreadInternal(id);
    },
    [selectThreadInternal],
  );

  const newThread = useCallback(async () => {
    const prevId = activeIdRef.current;
    if (prevId) {
      await maybeDeleteEmptyThread(prevId);
      emitLeave(prevId);
    }
    try {
      const thread = await api.createThread();
      const seq = ++selectSeqRef.current;
      setThreads((prev) => [{ ...thread, lastMessage: null }, ...prev]);
      loadedRef.current = thread.id;
      activeIdRef.current = thread.id;
      setActiveThreadId(thread.id);
      setMessages([]);
      setTasks([]);
      setPhase(null);
      setCanonHint(null);
      setMessagesLoading(false);
      const s = socketRef.current;
      if (s && s.connected) s.emit("thread:join", { threadId: thread.id });
    } catch {
      toast.error("Не удалось создать диалог");
    }
  }, [emitLeave, maybeDeleteEmptyThread]);

  /** New thread pre-bound to a project (project screen «Обсудить проект»). */
  const startProjectThread = useCallback(
    async (projectId: string, title: string) => {
      const prevId = activeIdRef.current;
      if (prevId) {
        await maybeDeleteEmptyThread(prevId);
        emitLeave(prevId);
      }
      try {
        const thread = await api.createThread({ projectId, title });
        const seq = ++selectSeqRef.current;
        setThreads((prev) => [{ ...thread, lastMessage: null }, ...prev]);
        loadedRef.current = thread.id;
        activeIdRef.current = thread.id;
        setActiveThreadId(thread.id);
        setMessages([]);
        setTasks([]);
        setPhase(null);
        setCanonHint(null);
        setMessagesLoading(false);
        const s = socketRef.current;
        if (s && s.connected) s.emit("thread:join", { threadId: thread.id });
        return true;
      } catch {
        toast.error("Не удалось создать диалог с проектом");
        return false;
      }
    },
    [emitLeave, maybeDeleteEmptyThread],
  );

  /** Optimistic mode switch; reverts the chip when the PATCH fails. */
  const updateThreadMode = useCallback(
    async (id: string, mode: ThreadMode) => {
      const prevMode = threadsRef.current.find((t) => t.id === id)?.mode;
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, mode } : t)),
      );
      try {
        await api.updateThread(id, { mode });
      } catch {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === id && prevMode ? { ...t, mode: prevMode } : t,
          ),
        );
        toast.error("Не удалось изменить режим диалога");
      }
    },
    [],
  );

  const deleteThread = useCallback(
    async (id: string) => {
      try {
        await api.deleteThread(id);
      } catch {
        toast.error("Не удалось удалить диалог");
        return;
      }
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeIdRef.current === id) {
        emitLeave(id);
        loadedRef.current = null;
        const next = threadsRef.current.find((t) => t.id !== id);
        if (next) {
          await selectThreadInternal(next.id, { skipCleanup: true });
        } else {
          const seq = ++selectSeqRef.current;
          activeIdRef.current = null;
          setActiveThreadId(null);
          setMessages([]);
          setTasks([]);
          setPhase(null);
          setMessagesLoading(false);
        }
      }
    },
    [emitLeave, selectThreadInternal],
  );

  const renameThread = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      const thread = await api.updateThread(id, { title: trimmed });
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: thread.title } : t)),
      );
    } catch {
      toast.error("Не удалось переименовать диалог");
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;
      if (
        shouldBlockSend({
          sending: sendLockRef.current,
          busy: busyRef.current,
          aborting: abortingRef.current !== null,
        })
      ) {
        return;
      }
      sendLockRef.current = true;

      // No active thread yet (fresh account / all deleted) — create one
      // transparently so the first message always works (Cursor-style).
      let threadId = activeIdRef.current;
      if (!threadId) {
        try {
          const thread = await api.createThread();
          setThreads((prev) => [{ ...thread, lastMessage: null }, ...prev]);
          loadedRef.current = thread.id;
          activeIdRef.current = thread.id;
          setActiveThreadId(thread.id);
          setMessages([]);
          setMessagesLoading(false);
          const s0 = socketRef.current;
          if (s0 && s0.connected) s0.emit("thread:join", { threadId: thread.id });
          threadId = thread.id;
        } catch {
          toast.error("Не удалось создать диалог");
          sendLockRef.current = false;
          return;
        }
      }

      const id = tempId();
      const now = new Date().toISOString();
      setCanonHint(null);
      setMessages((prev) => [
        ...prev,
        {
          id,
          threadId,
          role: "user",
          content: trimmed,
          createdAt: now,
          pending: true,
        },
      ]);
      bumpThread(threadId, {
        id,
        threadId,
        role: "user",
        content: trimmed,
        createdAt: now,
      });

      const ok = await ensureConnected();
      const s = socketRef.current;
      if (!ok || !s) {
        toast.error("Нет соединения — сообщение не отправлено");
        setMessages((prev) => prev.filter((m) => m.id !== id));
        sendLockRef.current = false;
        return;
      }
      // Make sure we are in the room before sending (idempotent on server).
      s.emit("thread:join", { threadId });
      setThinkingThreadId(threadId);
      busyRef.current = true;
      s.emit("message:send", { threadId, content: trimmed });
      sendLockRef.current = false;
    },
    [bumpThread, ensureConnected],
  );

  const abortTurn = useCallback(() => {
    const id = activeIdRef.current;
    const s = socketRef.current;
    if (id && s?.connected) s.emit("turn:abort", { threadId: id });
    abortingRef.current = id;
    if (id) {
      setThinkingThreadId(id);
      busyRef.current = true;
    }
    // Keep busy until message:end so a second send cannot race the in-flight tool.
    setMessages((prev) =>
      prev.filter((m) => !isEmptyAssistantBubble(m)),
    );
  }, []);

  // Re-join the active thread room after every (re)connect.
  useEffect(() => {
    if (!socket) return;
    const handleConnect = () => {
      const id = activeIdRef.current;
      if (id) socket.emit("thread:join", { threadId: id });
      if (!id) return;
      void (async () => {
        try {
          const { messages: loaded } = await api.getThread(id);
          if (activeIdRef.current !== id) return;
          setMessages((prev) => {
            const pending = prev.filter(
              (m) => m.pending && m.id.startsWith("temp-"),
            );
            const extra = pending.filter(
              (p) =>
                !loaded.some(
                  (l) => l.role === "user" && l.content === p.content,
                ),
            );
            return [...loaded.map((m) => ({ ...m })), ...extra];
          });
          const st = streamingRef.current;
          if (st && loaded.some((m) => m.id === st.messageId && m.content)) {
            setStreaming(null);
          }
        } catch {
          // next event or the 130s watchdog unlocks
        }
      })();
    };
    socket.on("connect", handleConnect);
    if (socket.connected) handleConnect();
    return () => {
      socket.off("connect", handleConnect);
    };
  }, [socket]);

  // WS event subscriptions.
  useEffect(() => {
    if (!socket) return;

    const onMessageUser = ({ message }: WsMessageUserPayload) => {
      if (message.threadId === activeIdRef.current) {
        setMessages((prev) => {
          // Replace the matching optimistic message…
          const reverseIdx = [...prev]
            .reverse()
            .findIndex(
              (m) => m.id.startsWith("temp-") && m.content === message.content,
            );
          if (reverseIdx >= 0) {
            const idx = prev.length - 1 - reverseIdx;
            const copy = [...prev];
            copy[idx] = { ...message };
            return copy;
          }
          // …or append if this came from another tab (dedup by id).
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, { ...message }];
        });
      }
      bumpThread(message.threadId, message);
    };

    const onAgentThinking = ({ threadId }: WsAgentThinkingPayload) => {
      setThinkingThreadId(threadId);
    };

    const onTasksUpdated = ({ threadId, tasks: updated }: WsTasksUpdatedPayload) => {
      if (threadId === activeIdRef.current) setTasks(updated);
    };

    const onTurnPhase = ({ threadId, phase: p, label }: WsTurnPhasePayload) => {
      if (threadId !== activeIdRef.current) return;
      if (p === "idle") {
        setPhase(null);
        return;
      }
      setPhase({ threadId, phase: p, label });
      // A phase event implies the agent is working (keep the indicator up).
      setThinkingThreadId(threadId);
    };

    const onCanonPrefetch = ({
      threadId,
      scope,
      hitCount,
    }: WsCanonPrefetchPayload) => {
      if (threadId !== activeIdRef.current) return;
      if (hitCount <= 0) return;
      setCanonHint({
        scope: scope === "workspace" ? "workspace" : "studio",
        hitCount,
      });
    };

    const onToolStart = ({
      threadId,
      messageId,
      tool,
      args,
    }: WsToolStartPayload) => {
      // Tool events for background threads are ignored — they will be loaded
      // from the REST history when the thread becomes active.
      if (threadId !== activeIdRef.current) return;
      // The tool card spinner replaces the typing indicator.
      setThinkingThreadId((cur) => (cur === threadId ? null : cur));
      setMessages((prev) => {
        if (prev.some((m) => m.id === messageId)) return prev;
        return [
          ...prev,
          {
            id: messageId,
            threadId,
            role: "tool" as const,
            content: "",
            toolName: tool,
            toolArgs: JSON.stringify(args ?? {}),
            toolResult: null,
            createdAt: new Date().toISOString(),
            toolPending: true,
          },
        ];
      });
    };

    const onToolEnd = ({
      threadId,
      messageId,
      tool,
      result,
    }: WsToolEndPayload) => {
      if (threadId !== activeIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                toolResult: JSON.stringify(result ?? {}),
                toolPending: false,
              }
            : m,
        ),
      );

      // create_note / open_note with a note payload → open it in the context
      // panel (auto: never pops the mobile dialog). New notes refresh the
      // notebook feed silently.
      if (tool === "create_note" || tool === "open_note") {
        const note = noteFromToolResult(tool, result);
        if (note) {
          const ui = useAppUi.getState();
          ui.openNote(note, { auto: true });
          if (tool === "create_note") ui.bumpNotes();
        }
      }
    };

    const onMessageStart = ({ threadId, messageId }: WsMessageStartPayload) => {
      setThinkingThreadId((cur) => (cur === threadId ? null : cur));
      setStreaming({ threadId, messageId });
      if (threadId === activeIdRef.current) {
        setMessages((prev) => [
          ...prev,
          {
            id: messageId,
            threadId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
            streaming: true,
          },
        ]);
      }
    };

    const onMessageDelta = ({
      threadId,
      messageId,
      delta,
    }: WsMessageDeltaPayload) => {
      if (threadId !== activeIdRef.current) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], content: copy[idx].content + delta };
          return copy;
        }
        // User switched back mid-stream: create the bubble on first delta.
        return [
          ...prev,
          {
            id: messageId,
            threadId,
            role: "assistant",
            content: delta,
            createdAt: new Date().toISOString(),
            streaming: true,
          },
        ];
      });
    };

    const onMessageEnd = ({ threadId, message }: WsMessageEndPayload) => {
      if (abortingRef.current === threadId) abortingRef.current = null;
      setStreaming((cur) =>
        cur && cur.threadId === threadId ? null : cur,
      );
      setThinkingThreadId((cur) => (cur === threadId ? null : cur));
      setPhase((cur) => (cur && cur.threadId === threadId ? null : cur));
      if (threadId === activeIdRef.current) {
        setMessages((prev) => {
          const withoutEmpty = prev.filter(
            (m) =>
              !(
                isEmptyAssistantBubble(m) &&
                m.id !== message.id
              ),
          );
          const idx = withoutEmpty.findIndex((m) => m.id === message.id);
          if (idx >= 0) {
            const copy = [...withoutEmpty];
            copy[idx] = { ...message };
            return copy;
          }
          return [...withoutEmpty, { ...message }];
        });
      }
      bumpThread(threadId, message);
    };

    const onThreadUpdated = ({ thread }: WsThreadUpdatedPayload) => {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id
            ? { ...t, title: thread.title, updatedAt: thread.updatedAt }
            : t,
        ),
      );
    };

    const onError = ({ message }: WsErrorPayload) => {
      toast.error(message);
      if (shouldKeepBusyOnSocketError(message)) return;
      abortingRef.current = null;
      setThinkingThreadId(null);
      setPhase(null);
      // A failed turn can leave tool cards stuck in the running state —
      // finalize them without a result.
      setMessages((prev) =>
        prev.some((m) => m.toolPending)
          ? prev.map((m) => (m.toolPending ? { ...m, toolPending: false } : m))
          : prev,
      );
      // If the turn failed before any content arrived, drop the empty
      // assistant bubble and clear the busy flag so the composer unlocks.
      const st = streamingRef.current;
      if (st) {
        const live = messagesRef.current.find((m) => m.id === st.messageId);
        if (!live || live.content === "") {
          setStreaming((cur) =>
            cur && cur.messageId === st.messageId ? null : cur,
          );
          setMessages((prev) =>
            prev.filter(
              (m) => !(m.role === "assistant" && m.streaming && m.content === ""),
            ),
          );
        }
      }
    };

    socket.on("message:user", onMessageUser);
    socket.on("agent:thinking", onAgentThinking);
    socket.on("message:start", onMessageStart);
    socket.on("message:delta", onMessageDelta);
    socket.on("message:end", onMessageEnd);
    socket.on("thread:updated", onThreadUpdated);
    socket.on("tool:start", onToolStart);
    socket.on("tool:end", onToolEnd);
    socket.on("tasks:updated", onTasksUpdated);
    socket.on("turn:phase", onTurnPhase);
    socket.on("canon:prefetch", onCanonPrefetch);
    socket.on("error", onError);

    return () => {
      socket.off("message:user", onMessageUser);
      socket.off("agent:thinking", onAgentThinking);
      socket.off("message:start", onMessageStart);
      socket.off("message:delta", onMessageDelta);
      socket.off("message:end", onMessageEnd);
      socket.off("thread:updated", onThreadUpdated);
      socket.off("tool:start", onToolStart);
      socket.off("tool:end", onToolEnd);
      socket.off("tasks:updated", onTasksUpdated);
      socket.off("turn:phase", onTurnPhase);
      socket.off("canon:prefetch", onCanonPrefetch);
      socket.off("error", onError);
    };
  }, [socket, bumpThread]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  const thinking = thinkingThreadId !== null && thinkingThreadId === activeThreadId;

  // Tool cards in the running state also mean the agent is still working.
  const toolBusy = messages.some(
    (m) => m.role === "tool" && m.toolPending === true,
  );

  const activeBusy =
    thinking || streaming?.threadId === activeThreadId || toolBusy;

  useEffect(() => {
    busyRef.current = activeBusy;
  }, [activeBusy]);

  useEffect(() => {
    if (!activeBusy) return;
    const t = window.setTimeout(() => {
      toast.error("Агент завис — остановите генерацию или отправьте снова");
      abortTurn();
      abortingRef.current = null;
      setThinkingThreadId(null);
      setStreaming(null);
      setPhase(null);
      setMessages((prev) =>
        prev.map((m) => (m.toolPending ? { ...m, toolPending: false } : m)),
      );
    }, 130_000);
    return () => window.clearTimeout(t);
  }, [activeBusy, abortTurn]);

  const activePhase =
    phase && phase.threadId === activeThreadId
      ? { phase: phase.phase, label: phase.label }
      : null;

  const value = useMemo<ThreadsContextValue>(
    () => ({
      threads,
      threadsLoading,
      activeThreadId,
      activeThread,
      messages,
      messagesLoading,
      busy: activeBusy,
      thinking,
      phase: activePhase,
      tasks,
      selectThread,
      newThread,
      deleteThread,
      renameThread,
      updateThreadMode,
      startProjectThread,
      sendMessage,
      abortTurn,
      canonHint,
    }),
    [
      threads,
      threadsLoading,
      activeThreadId,
      activeThread,
      messages,
      messagesLoading,
      thinking,
      streaming,
      activeBusy,
      activePhase,
      tasks,
      selectThread,
      newThread,
      deleteThread,
      renameThread,
      updateThreadMode,
      startProjectThread,
      sendMessage,
      abortTurn,
      canonHint,
    ],
  );

  return (
    <ThreadsContext.Provider value={value}>{children}</ThreadsContext.Provider>
  );
}

export function useThreads(): ThreadsContextValue {
  const ctx = useContext(ThreadsContext);
  if (!ctx) {
    throw new Error("useThreads must be used within <ThreadsProvider>");
  }
  return ctx;
}
