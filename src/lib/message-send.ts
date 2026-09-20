/**
 * socket.io `message:send` payload guard.
 * Cap is UTF-8 bytes of trimmed user text (32–64 KiB band) so a paste bomb
 * never reaches the agent turn. Pure functions — unit-testable without IO.
 */

/** User `content` after trim — 64 KiB UTF-8. */
export const MESSAGE_SEND_MAX_BYTES = 64 * 1024;

/**
 * Engine.io packet cap: JSON envelope around max user text, not a 1 MB hang.
 * Must stay above MESSAGE_SEND_MAX_BYTES so the handler can still emit RU error.
 */
export const MESSAGE_SEND_MAX_PACKET_BYTES = 96 * 1024;

export const MESSAGE_SEND_INVALID = "Некорректный запрос";
export const MESSAGE_SEND_EMPTY = "Сообщение не может быть пустым";
export const MESSAGE_SEND_TOO_LARGE = "Сообщение слишком длинное";

const encoder = new TextEncoder();

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).byteLength;
}

export function formatMessageSendLimit(bytes: number): string {
  return `${Math.round(bytes / 1024)} КБ`;
}

export function messageSendTooLargeMessage(
  limitBytes: number = MESSAGE_SEND_MAX_BYTES,
): string {
  return `${MESSAGE_SEND_TOO_LARGE} (максимум ${formatMessageSendLimit(limitBytes)})`;
}

export function isOversizedMessageText(
  text: string,
  limitBytes: number = MESSAGE_SEND_MAX_BYTES,
): boolean {
  return utf8ByteLength(text) > limitBytes;
}

export type MessageSendOk = {
  ok: true;
  threadId: string;
  text: string;
};

export type MessageSendErr = {
  ok: false;
  message: string;
};

export type MessageSendResult = MessageSendOk | MessageSendErr;

/**
 * Parse `message:send` `{threadId, content}` before any DB or LLM work.
 */
export function parseMessageSend(payload: unknown): MessageSendResult {
  const { threadId, content } = (payload ?? {}) as {
    threadId?: unknown;
    content?: unknown;
  };
  if (typeof threadId !== "string" || !threadId || typeof content !== "string") {
    return { ok: false, message: MESSAGE_SEND_INVALID };
  }
  const text = content.trim();
  if (!text) {
    return { ok: false, message: MESSAGE_SEND_EMPTY };
  }
  if (isOversizedMessageText(text)) {
    return { ok: false, message: messageSendTooLargeMessage() };
  }
  return { ok: true, threadId, text };
}
