/**
 * Apply live chat socket events to the transcript.
 * Tokens append immediately — the UI must not wait for `message:end`.
 * Start + delta + end must never create duplicate bubbles; late deltas
 * after abort/end must not crash or resurrect a finished turn.
 */

import { isEmptyAssistantBubble } from "./chat-send-guard";
import type { ChatMessage } from "./types";

export interface MessageDeltaPayload {
  threadId: string;
  messageId: string;
  delta: string;
}

export interface MessageStartPayload {
  threadId: string;
  messageId: string;
}

export interface MessageEndPayload {
  threadId: string;
  message: Partial<ChatMessage> & { id: string; threadId?: string };
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function sameThread(
  payloadThreadId: string,
  activeThreadId: string | null,
): boolean {
  return Boolean(activeThreadId) && payloadThreadId === activeThreadId;
}

/** Start: upsert the live bubble. Never append a second row with the same id. */
export function applyMessageStart(
  messages: ChatMessage[],
  payload: MessageStartPayload,
  activeThreadId: string | null,
  abortedThreadId: string | null = null,
): ChatMessage[] {
  if (!payload?.messageId) return messages;
  if (!sameThread(payload.threadId, activeThreadId)) return messages;
  if (abortedThreadId && payload.threadId === abortedThreadId) return messages;
  const idx = messages.findIndex((m) => m.id === payload.messageId);
  if (idx >= 0) {
    const prev = messages[idx]!;
    if (prev.streaming === false) return messages;
    if (prev.streaming) return messages;
    const copy = [...messages];
    copy[idx] = { ...prev, streaming: true };
    return copy;
  }
  return [
    ...messages,
    {
      id: payload.messageId,
      threadId: payload.threadId,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      streaming: true,
    },
  ];
}

export function applyMessageDelta(
  messages: ChatMessage[],
  payload: MessageDeltaPayload,
  activeThreadId: string | null,
  abortedThreadId: string | null = null,
): ChatMessage[] {
  if (!payload || payload.threadId !== activeThreadId) return messages;
  if (abortedThreadId && payload.threadId === abortedThreadId) return messages;
  const delta = asText(payload.delta);
  if (!delta || !payload.messageId) return messages;

  const idx = messages.findIndex((m) => m.id === payload.messageId);
  if (idx >= 0) {
    const prev = messages[idx]!;
    if (prev.streaming === false) return messages;
    const copy = [...messages];
    copy[idx] = {
      ...prev,
      content: asText(prev.content) + delta,
      streaming: true,
    };
    return copy;
  }
  return [
    ...messages,
    {
      id: payload.messageId,
      threadId: payload.threadId,
      role: "assistant",
      content: delta,
      createdAt: new Date().toISOString(),
      streaming: true,
    },
  ];
}

export function applyMessageEnd(
  messages: ChatMessage[],
  payload: MessageEndPayload,
  activeThreadId: string | null,
): ChatMessage[] {
  const message = payload?.message;
  if (!message || typeof message.id !== "string") return messages;
  if (!sameThread(payload.threadId, activeThreadId)) return messages;

  const finalized: ChatMessage = {
    id: message.id,
    threadId: message.threadId ?? payload.threadId,
    role: (message.role as ChatMessage["role"]) ?? "assistant",
    content: asText(message.content),
    createdAt:
      typeof message.createdAt === "string"
        ? message.createdAt
        : new Date().toISOString(),
    toolName: message.toolName,
    toolArgs: message.toolArgs,
    toolResult: message.toolResult,
    streaming: false,
    pending: false,
  };

  const withoutEmpty = messages.filter(
    (m) => !(isEmptyAssistantBubble(m) && m.id !== finalized.id),
  );
  const idx = withoutEmpty.findIndex((m) => m.id === finalized.id);
  if (idx >= 0) {
    const copy = [...withoutEmpty];
    copy[idx] = { ...withoutEmpty[idx]!, ...finalized, streaming: false };
    return copy;
  }
  return [...withoutEmpty, finalized];
}

/** Stop: drop empty live bubbles and freeze partial text. */
export function applyAbortTurn(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => !isEmptyAssistantBubble(m))
    .map((m) => (m.streaming ? { ...m, streaming: false } : m));
}

/**
 * Socket reconnect: REST is behind the live buffer (DB writes empty on
 * start, full text only on end). Keep the longer live content.
 */
export function mergeTranscriptOnReconnect(
  prev: ChatMessage[],
  loaded: ChatMessage[],
): ChatMessage[] {
  const prevById = new Map(prev.map((m) => [m.id, m]));
  const merged = loaded.map((row) => {
    const live = prevById.get(row.id);
    if (!live) return { ...row, streaming: false };
    const liveText = asText(live.content);
    const rowText = asText(row.content);
    if (live.streaming || liveText.length > rowText.length) {
      return {
        ...row,
        ...live,
        content: liveText.length >= rowText.length ? liveText : rowText,
        streaming: live.streaming === true && rowText.length === 0,
      };
    }
    return { ...row, streaming: false };
  });
  const loadedIds = new Set(loaded.map((m) => m.id));
  const extra = prev.filter((m) => {
    if (m.pending && m.id.startsWith("temp-")) {
      return !loaded.some((l) => l.role === "user" && l.content === m.content);
    }
    return Boolean(m.streaming && !loadedIds.has(m.id));
  });
  return [...merged, ...extra];
}
