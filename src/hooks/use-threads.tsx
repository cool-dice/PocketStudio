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
import type {
  ChatMessage,
  Message,
  ThreadListItem,
  WsAgentThinkingPayload,
  WsErrorPayload,
  WsMessageDeltaPayload,
  WsMessageEndPayload,
  WsMessageStartPayload,
  WsMessageUserPayload,
  WsThreadUpdatedPayload,
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
  selectThread: (id: string) => Promise<void>;
  newThread: () => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  renameThread: (id: string, title: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
}

const ThreadsContext = createContext<ThreadsContextValue | null>(null);

function tempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ThreadsProvider({ children }: { children: ReactNode }) {
  const { socket, ensureConnected } = useSocket();

  const [threads, setThreads] = useState<ThreadListItem[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [thinkingThreadId, setThinkingThreadId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<{
    threadId: string;
    messageId: string;
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
          role: message.role,
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
      setMessagesLoading(true);

      try {
        const { thread, messages: loaded } = await api.getThread(id);
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
      setMessagesLoading(false);
      const s = socketRef.current;
      if (s && s.connected) s.emit("thread:join", { threadId: thread.id });
    } catch {
      toast.error("Не удалось создать диалог");
    }
  }, [emitLeave, maybeDeleteEmptyThread]);

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
          return;
        }
      }

      const id = tempId();
      const now = new Date().toISOString();
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
        return;
      }
      // Make sure we are in the room before sending (idempotent on server).
      s.emit("thread:join", { threadId });
      s.emit("message:send", { threadId, content: trimmed });
    },
    [bumpThread, ensureConnected],
  );

  // Re-join the active thread room after every (re)connect.
  useEffect(() => {
    if (!socket) return;
    const handleConnect = () => {
      const id = activeIdRef.current;
      if (id) socket.emit("thread:join", { threadId: id });
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
      setStreaming((cur) =>
        cur && cur.threadId === threadId ? null : cur,
      );
      setThinkingThreadId((cur) => (cur === threadId ? null : cur));
      if (threadId === activeIdRef.current) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === message.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...message };
            return copy;
          }
          return [...prev, { ...message }];
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
      setThinkingThreadId(null);
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
    socket.on("error", onError);

    return () => {
      socket.off("message:user", onMessageUser);
      socket.off("agent:thinking", onAgentThinking);
      socket.off("message:start", onMessageStart);
      socket.off("message:delta", onMessageDelta);
      socket.off("message:end", onMessageEnd);
      socket.off("thread:updated", onThreadUpdated);
      socket.off("error", onError);
    };
  }, [socket, bumpThread]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) ?? null,
    [threads, activeThreadId],
  );

  const thinking = thinkingThreadId !== null && thinkingThreadId === activeThreadId;

  const value = useMemo<ThreadsContextValue>(
    () => ({
      threads,
      threadsLoading,
      activeThreadId,
      activeThread,
      messages,
      messagesLoading,
      busy: thinking || streaming?.threadId === activeThreadId,
      thinking,
      selectThread,
      newThread,
      deleteThread,
      renameThread,
      sendMessage,
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
      selectThread,
      newThread,
      deleteThread,
      renameThread,
      sendMessage,
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
