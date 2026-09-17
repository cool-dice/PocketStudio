/**
 * VibeFlow shared client types — mirror the REST/WS API shapes
 * (see worklog Task 1 contracts, 2-a auth routes, 2-b agent-service).
 */

export type Role = "admin" | "client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
}

export type ThreadMode = "ask" | "plan" | "act" | "review";

export interface Thread {
  id: string;
  title: string;
  mode: ThreadMode;
  archived: boolean;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadLastMessage {
  content: string;
  role: "user" | "assistant";
  createdAt: string;
}

export interface ThreadListItem extends Thread {
  lastMessage: ThreadLastMessage | null;
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

/** Client-side message with optimistic/streaming flags. */
export interface ChatMessage extends Message {
  /** Optimistic user message not yet confirmed by the server. */
  pending?: boolean;
  /** Assistant message currently being streamed. */
  streaming?: boolean;
}

/* ── WS payloads (mini-services/agent-service contract) ── */

export interface WsMessageUserPayload {
  message: Message;
}

export interface WsAgentThinkingPayload {
  threadId: string;
}

export interface WsMessageStartPayload {
  threadId: string;
  messageId: string;
}

export interface WsMessageDeltaPayload {
  threadId: string;
  messageId: string;
  delta: string;
}

export interface WsMessageEndPayload {
  threadId: string;
  message: Message;
}

export interface WsThreadUpdatedPayload {
  thread: {
    id: string;
    title: string;
    updatedAt: string;
  };
}

export interface WsErrorPayload {
  message: string;
}

export const MODE_LABELS: Record<ThreadMode, string> = {
  ask: "Спросить",
  plan: "План",
  act: "Действовать",
  review: "Ревью",
};

export const MAX_MESSAGE_LENGTH = 20000;
