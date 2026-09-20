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

/** Show the composer counter once this much room is left (or already over). */
export const MESSAGE_SEND_COUNT_NEAR_BYTES = 8 * 1024;

/**
 * HTML `maxLength` is characters, not UTF-8. Cap paste bombs while still
 * letting ASCII go one byte over so the RU error can appear.
 */
export const COMPOSER_TEXTAREA_MAX_CHARS = MESSAGE_SEND_MAX_BYTES + 1;

/** True for the socket `error` payload `parseMessageSend` emits on oversize. */
export function isMessageSendTooLargeError(
  message: string | null | undefined,
): boolean {
  return typeof message === "string" && message.includes(MESSAGE_SEND_TOO_LARGE);
}

export function formatComposerByteCount(
  usedBytes: number,
  limitBytes: number = MESSAGE_SEND_MAX_BYTES,
): string {
  return `${Math.round(usedBytes / 1024)} / ${formatMessageSendLimit(limitBytes)}`;
}

export type ComposerSizeUi = {
  bytes: number;
  oversized: boolean;
  showCount: boolean;
  disableSend: boolean;
  error: string | null;
  countLabel: string;
};

/**
 * Composer send/count/error from the draft plus optional socket `error`
 * message. Oversize copy is the same Russian string the server emits.
 */
export function composerSizeUi(
  draft: string,
  socketError: string | null = null,
  limitBytes: number = MESSAGE_SEND_MAX_BYTES,
): ComposerSizeUi {
  const bytes = utf8ByteLength(draft.trim());
  const oversized = bytes > limitBytes;
  const socketOversize = isMessageSendTooLargeError(socketError);
  const error = oversized
    ? socketOversize && socketError
      ? socketError
      : messageSendTooLargeMessage(limitBytes)
    : socketOversize
      ? socketError
      : null;
  const remaining = limitBytes - bytes;
  const showCount =
    oversized || (bytes > 0 && remaining <= MESSAGE_SEND_COUNT_NEAR_BYTES);
  return {
    bytes,
    oversized,
    showCount,
    disableSend: oversized,
    error,
    countLabel: formatComposerByteCount(bytes, limitBytes),
  };
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
