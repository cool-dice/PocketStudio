/**
 * Apply a live `message:delta` socket event to the chat transcript.
 * Tokens append immediately — the UI must not wait for `message:end`.
 */

import type { ChatMessage } from "./types";

export interface MessageDeltaPayload {
  threadId: string;
  messageId: string;
  delta: string;
}

export function applyMessageDelta(
  messages: ChatMessage[],
  payload: MessageDeltaPayload,
  activeThreadId: string | null,
): ChatMessage[] {
  if (payload.threadId !== activeThreadId) return messages;
  const idx = messages.findIndex((m) => m.id === payload.messageId);
  if (idx >= 0) {
    const copy = [...messages];
    const prev = copy[idx]!;
    copy[idx] = { ...prev, content: prev.content + payload.delta, streaming: true };
    return copy;
  }
  return [
    ...messages,
    {
      id: payload.messageId,
      threadId: payload.threadId,
      role: "assistant",
      content: payload.delta,
      createdAt: new Date().toISOString(),
      streaming: true,
    },
  ];
}
