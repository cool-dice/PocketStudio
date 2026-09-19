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

import {
  applyAbortTurn,
  applyMessageDelta,
  applyMessageEnd,
  applyMessageStart,
  mergeTranscriptOnReconnect,
} from "@/lib/message-delta";
import { api } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import {
  shouldBlockSend,
  shouldKeepBusyOnSocketError,
} from "@/lib/chat-send-guard";
import {
  THREADS_DELETE_FAILED,
  THREADS_LOAD_ERROR,
  THREADS_RENAME_FAILED,
  composerTargetAfterArchive,
  composerTargetAfterDelete,
  renamedTitle,
  resolveSendThreadId,
  sidebarThreadsAfterArchive,
  sidebarThreadsAfterDelete,
  threadArchiveToast,
} from "@/lib/thread-copy";
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
  /** Failed list fetch — never paint this as «пока нет диалогов». */
  threadsError: string | null;
  refreshThreads: () => Promise<void>;
  /** Sidebar is listing archived threads (`?archived=1`). */
  showArchived: boolean;
  toggleShowArchived: () => Promise<void>;
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
  deleteThread: (id: string) => Promise<boolean>;
  renameThread: (id: string, title: string) => Promise<void>;
  /** Archive or restore after PATCH — sidebar updates only on success. */
  archiveThread: (id: string, archived: boolean) => Promise<boolean>;
  /** Switch the thread mode (ask/plan/act/review) — optimistic + PATCH. */
  updateThreadMode: (id: string, mode: ThreadMode) => Promise<void>;
  /**
   * Create a new thread bound to a project («Обсудить проект») and make it
   * active. Returns the thread or null on failure.
   */
  startProjectThread: (projectId: string, title: string) => Promise<boolean>;
  /**
   * Bind the active thread to studio scope (projectId === null) without
   * deleting an empty workspace thread the user just opened.
   */
  ensureStudioThread: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  abortTurn: () => void;
  /** Short RAG hint after prefetch (not the chunks themselves). */
  canonHint: {
    scope: "studio" | "workspace";
    hitCount: number;
    mode?: "vector" | "keyword";
  } | null;
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
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
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
    mode?: "vector" | "keyword";
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
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const threadsErrorRef = useRef<string | null>(null);
  const showArchivedRef = useRef(false);

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
    threadsErrorRef.current = threadsError;
  }, [threadsError]);
  useEffect(() => {
    showArchivedRef.current = showArchived;
  }, [showArchived]);
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
      deletedIdsRef.current.add(threadId);
      setThreads((prev) => sidebarThreadsAfterDelete(prev, threadId, true));
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
      // Same id with messages already loaded is a no-op. After deleting the
      // active thread we clear loadedRef so the next row still hydrates even
      // if we pointed the composer at it synchronously.
      if (prevId === id && loadedRef.current === id) return;

      if (prevId && prevId !== id && !opts?.skipCleanup) {
        await maybeDeleteEmptyThread(prevId);
      }
      if (prevId && prevId !== id) emitLeave(prevId);

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

  const refreshThreads = useCallback(async (): Promise<ThreadListItem[] | null> => {
    setThreadsLoading(true);
    setThreadsError(null);
    try {
      const list = await api.listThreads({
        archived: showArchivedRef.current,
      });
      setThreads(list);
      threadsRef.current = list;
      const stillValid =
        activeIdRef.current !== null &&
        list.some((t) => t.id === activeIdRef.current);
      if (!stillValid && list.length > 0) {
        await selectRef.current(list[0].id, { skipCleanup: true });
      }
      if (!stillValid && list.length === 0) {
        activeIdRef.current = null;
        loadedRef.current = null;
        setActiveThreadId(null);
        setMessages([]);
        setTasks([]);
        setPhase(null);
        setMessagesLoading(false);
      }
      return list;
    } catch {
      setThreadsError(THREADS_LOAD_ERROR);
      return null;
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  const toggleShowArchived = useCallback(async () => {
    const next = !showArchivedRef.current;
    showArchivedRef.current = next;
    setShowArchived(next);
    await refreshThreads();
  }, [refreshThreads]);

  /** New live threads must not land in the archive list. */
  const adoptLiveThread = useCallback(async (thread: ThreadListItem) => {
    const wasArchive = showArchivedRef.current;
    showArchivedRef.current = false;
    setShowArchived(false);
    if (wasArchive) {
      try {
        const list = await api.listThreads();
        const next = [thread, ...list.filter((t) => t.id !== thread.id)];
        setThreads(next);
        threadsRef.current = next;
      } catch {
        const next = [
          thread,
          ...threadsRef.current.filter((t) => t.id !== thread.id && !t.archived),
        ];
        setThreads(next);
        threadsRef.current = next;
      }
    } else {
      const next = [
        thread,
        ...threadsRef.current.filter((t) => t.id !== thread.id),
      ];
      setThreads(next);
      threadsRef.current = next;
    }
  }, []);

  // Initial load: thread list + auto-select the most recent thread.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listThreads();
        if (cancelled) return;
        setThreads(list);
        threadsRef.current = list;
        setThreadsError(null);
        if (list.length > 0) {
          await selectRef.current(list[0].id, { skipCleanup: true });
        }
      } catch {
        if (!cancelled) setThreadsError(THREADS_LOAD_ERROR);
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
      ++selectSeqRef.current;
      await adoptLiveThread({ ...thread, lastMessage: null });
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
  }, [adoptLiveThread, emitLeave, maybeDeleteEmptyThread]);

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
        ++selectSeqRef.current;
        await adoptLiveThread({ ...thread, lastMessage: null });
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
    [adoptLiveThread, emitLeave, maybeDeleteEmptyThread],
  );

  /** Home/studio chat: never keep a workspace-bound thread as the active one. */
  const ensureStudioThread = useCallback(async () => {
    if (threadsErrorRef.current) return;
    if (showArchivedRef.current) {
      showArchivedRef.current = false;
      setShowArchived(false);
      const list = await refreshThreads();
      if (!list) return;
    }
    const current = threadsRef.current.find((t) => t.id === activeIdRef.current);
    if (current && !current.archived && current.projectId == null) return;
    const studio = threadsRef.current.find(
      (t) => !t.archived && t.projectId == null,
    );
    if (studio) {
      await selectThreadInternal(studio.id, { skipCleanup: true });
      return;
    }
    try {
      const thread = await api.createThread();
      ++selectSeqRef.current;
      await adoptLiveThread({ ...thread, lastMessage: null });
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
      toast.error("Не удалось открыть диалог студии");
    }
  }, [adoptLiveThread, refreshThreads, selectThreadInternal]);

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
        toast.error(THREADS_DELETE_FAILED);
        return false;
      }
      deletedIdsRef.current.add(id);
      const knownIds = threadsRef.current.map((t) => t.id);
      const nextId = composerTargetAfterDelete(
        activeIdRef.current,
        id,
        knownIds,
      );
      setThreads((prev) => sidebarThreadsAfterDelete(prev, id, true));
      if (activeIdRef.current !== id) return true;

      emitLeave(id);
      loadedRef.current = null;
      setMessages([]);
      setTasks([]);
      setPhase(null);
      setStreaming((cur) => (cur?.threadId === id ? null : cur));
      setThinkingThreadId((cur) => (cur === id ? null : cur));
      // Point the composer away from the deleted id before awaiting GET.
      activeIdRef.current = nextId;
      setActiveThreadId(nextId);
      setMessagesLoading(Boolean(nextId));
      if (nextId) {
        await selectThreadInternal(nextId, { skipCleanup: true });
      } else {
        ++selectSeqRef.current;
        setMessagesLoading(false);
      }
      return true;
    },
    [emitLeave, selectThreadInternal],
  );

  const renameThread = useCallback(async (id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const previous =
      threadsRef.current.find((t) => t.id === id)?.title ?? trimmed;
    try {
      const thread = await api.updateThread(id, { title: trimmed });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, title: renamedTitle(true, previous, thread.title) }
            : t,
        ),
      );
    } catch {
      setThreads((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, title: renamedTitle(false, previous, trimmed) } : t,
        ),
      );
      toast.error(THREADS_RENAME_FAILED);
    }
  }, []);

  const archiveThread = useCallback(
    async (id: string, archived: boolean) => {
      let nextArchived = archived;
      try {
        const thread = await api.updateThread(id, { archived });
        nextArchived = thread.archived;
      } catch {
        const failed = threadArchiveToast(false, archived);
        toast.error(failed.message);
        return false;
      }
      const okToast = threadArchiveToast(true, nextArchived);
      toast.success(okToast.message);

      const showingArchive = showArchivedRef.current;
      const nextRows = sidebarThreadsAfterArchive(
        threadsRef.current,
        id,
        nextArchived,
        showingArchive,
        true,
      );
      const droppedFromList = nextRows.length !== threadsRef.current.length;
      const knownIds = threadsRef.current.map((t) => t.id);
      const nextId = composerTargetAfterArchive(
        activeIdRef.current,
        id,
        knownIds,
        droppedFromList,
      );
      setThreads(nextRows);
      threadsRef.current = nextRows;
      if (activeIdRef.current !== id || !droppedFromList) return true;

      emitLeave(id);
      loadedRef.current = null;
      setMessages([]);
      setTasks([]);
      setPhase(null);
      setStreaming((cur) => (cur?.threadId === id ? null : cur));
      setThinkingThreadId((cur) => (cur === id ? null : cur));
      activeIdRef.current = nextId;
      setActiveThreadId(nextId);
      setMessagesLoading(Boolean(nextId));
      if (nextId) {
        await selectThreadInternal(nextId, { skipCleanup: true });
      } else {
        ++selectSeqRef.current;
        setMessagesLoading(false);
      }
      return true;
    },
    [emitLeave, selectThreadInternal],
  );

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

      // No active thread yet (fresh account / last one deleted) — create one
      // transparently so the first message always works (Cursor-style).
      // Never send to a thread the sidebar already dropped.
      const knownIds = threadsRef.current.map((t) => t.id);
      let threadId = resolveSendThreadId(
        activeIdRef.current,
        knownIds,
        deletedIdsRef.current,
      );
      if (!threadId) {
        try {
          const thread = await api.createThread();
          await adoptLiveThread({ ...thread, lastMessage: null });
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
    [adoptLiveThread, bumpThread, ensureConnected],
  );

  const abortTurn = useCallback(() => {
    const id = activeIdRef.current;
    const s = socketRef.current;
    if (id && s?.connected) s.emit("turn:abort", { threadId: id });
    abortingRef.current = id;
    setStreaming(null);
    if (id) {
      setThinkingThreadId(id);
      busyRef.current = true;
    }
    // Keep busy until message:end so a second send cannot race the in-flight tool.
    setMessages((prev) => applyAbortTurn(prev));
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
          setMessages((prev) =>
            mergeTranscriptOnReconnect(
              prev,
              loaded.map((m) => ({ ...m })),
            ),
          );
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
      mode,
    }: WsCanonPrefetchPayload) => {
      if (threadId !== activeIdRef.current) return;
      if (hitCount <= 0) return;
      setCanonHint({
        scope: scope === "workspace" ? "workspace" : "studio",
        hitCount,
        mode,
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
      if (abortingRef.current === threadId) return;
      setThinkingThreadId((cur) => (cur === threadId ? null : cur));
      if (threadId === activeIdRef.current) {
        setStreaming({ threadId, messageId });
      }
      setMessages((prev) =>
        applyMessageStart(
          prev,
          { threadId, messageId },
          activeIdRef.current,
          abortingRef.current,
        ),
      );
    };

    const onMessageDelta = ({
      threadId,
      messageId,
      delta,
    }: WsMessageDeltaPayload) => {
      setMessages((prev) =>
        applyMessageDelta(
          prev,
          { threadId, messageId, delta },
          activeIdRef.current,
          abortingRef.current,
        ),
      );
    };

    const onMessageEnd = ({ threadId, message }: WsMessageEndPayload) => {
      if (abortingRef.current === threadId) abortingRef.current = null;
      setStreaming((cur) =>
        cur && cur.threadId === threadId ? null : cur,
      );
      setThinkingThreadId((cur) => (cur === threadId ? null : cur));
      setPhase((cur) => (cur && cur.threadId === threadId ? null : cur));
      setMessages((prev) =>
        applyMessageEnd(
          prev,
          { threadId, message },
          activeIdRef.current,
        ),
      );
      if (message) bumpThread(threadId, message);
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
      threadsError,
      refreshThreads,
      showArchived,
      toggleShowArchived,
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
      archiveThread,
      updateThreadMode,
      startProjectThread,
      ensureStudioThread,
      sendMessage,
      abortTurn,
      canonHint,
    }),
    [
      threads,
      threadsLoading,
      threadsError,
      refreshThreads,
      showArchived,
      toggleShowArchived,
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
      archiveThread,
      updateThreadMode,
      startProjectThread,
      ensureStudioThread,
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
