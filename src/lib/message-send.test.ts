import { describe, expect, test } from "bun:test";

import {
  COMPOSER_TEXTAREA_MAX_CHARS,
  MESSAGE_SEND_COUNT_NEAR_BYTES,
  MESSAGE_SEND_EMPTY,
  MESSAGE_SEND_INVALID,
  MESSAGE_SEND_MAX_BYTES,
  MESSAGE_SEND_MAX_PACKET_BYTES,
  MESSAGE_SEND_TOO_LARGE,
  composerSizeUi,
  formatComposerByteCount,
  formatMessageSendLimit,
  isMessageSendTooLargeError,
  isOversizedMessageText,
  messageSendTooLargeMessage,
  parseMessageSend,
  utf8ByteLength,
} from "./message-send";

const THREAD = "thread-test-1";

describe("message:send size cap", () => {
  test("packet cap sits in the 32–64 KiB band and leaves envelope room", () => {
    expect(MESSAGE_SEND_MAX_BYTES).toBe(64 * 1024);
    expect(MESSAGE_SEND_MAX_BYTES).toBeGreaterThanOrEqual(32 * 1024);
    expect(MESSAGE_SEND_MAX_BYTES).toBeLessThanOrEqual(64 * 1024);
    expect(MESSAGE_SEND_MAX_PACKET_BYTES).toBeGreaterThan(MESSAGE_SEND_MAX_BYTES);
    expect(MESSAGE_SEND_MAX_PACKET_BYTES).toBeLessThanOrEqual(128 * 1024);
  });

  test("accepts a normal Russian chat line", () => {
    const got = parseMessageSend({
      threadId: THREAD,
      content: "  Запиши мысль про маяк  ",
    });
    expect(got).toEqual({
      ok: true,
      threadId: THREAD,
      text: "Запиши мысль про маяк",
    });
  });

  test("rejects missing fields with the same Russian invalid copy", () => {
    expect(parseMessageSend(null).ok).toBe(false);
    expect(parseMessageSend({}).ok).toBe(false);
    expect(parseMessageSend({ threadId: THREAD }).ok).toBe(false);
    expect(parseMessageSend({ content: "привет" }).ok).toBe(false);
    expect(parseMessageSend({ threadId: "", content: "привет" }).ok).toBe(false);
    expect(parseMessageSend({ threadId: THREAD, content: 12 }).ok).toBe(false);
    const err = parseMessageSend({ threadId: THREAD, content: null });
    expect(err).toEqual({ ok: false, message: MESSAGE_SEND_INVALID });
    expect(err.ok).toBe(false);
    if (!err.ok) expect(err.message).toMatch(/[А-Яа-яЁё]/);
  });

  test("rejects blank content after trim", () => {
    expect(parseMessageSend({ threadId: THREAD, content: "   \n\t" })).toEqual({
      ok: false,
      message: MESSAGE_SEND_EMPTY,
    });
    expect(MESSAGE_SEND_EMPTY).toMatch(/[А-Яа-яЁё]/);
  });

  test("accepts user text at exactly 64 KiB UTF-8", () => {
    const ascii = "a".repeat(MESSAGE_SEND_MAX_BYTES);
    expect(utf8ByteLength(ascii)).toBe(MESSAGE_SEND_MAX_BYTES);
    const got = parseMessageSend({ threadId: THREAD, content: ascii });
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.text).toHaveLength(MESSAGE_SEND_MAX_BYTES);
  });

  test("rejects user text one byte over the cap with a Russian error", () => {
    const ascii = "a".repeat(MESSAGE_SEND_MAX_BYTES + 1);
    const got = parseMessageSend({ threadId: THREAD, content: ascii });
    expect(got).toEqual({
      ok: false,
      message: messageSendTooLargeMessage(),
    });
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.message).toMatch(/[А-Яа-яЁё]/);
      expect(got.message).toContain("64 КБ");
      expect(got.message).toContain(MESSAGE_SEND_TOO_LARGE);
    }
  });

  test("counts UTF-8 bytes, not JS string length (Cyrillic / emoji)", () => {
    const cyrExact = "я".repeat(MESSAGE_SEND_MAX_BYTES / 2);
    expect(cyrExact.length).toBe(MESSAGE_SEND_MAX_BYTES / 2);
    expect(utf8ByteLength(cyrExact)).toBe(MESSAGE_SEND_MAX_BYTES);
    expect(parseMessageSend({ threadId: THREAD, content: cyrExact }).ok).toBe(
      true,
    );

    const cyrOver = `${cyrExact}я`;
    expect(utf8ByteLength(cyrOver)).toBe(MESSAGE_SEND_MAX_BYTES + 2);
    expect(parseMessageSend({ threadId: THREAD, content: cyrOver }).ok).toBe(
      false,
    );

    const emoji = "🌊".repeat(MESSAGE_SEND_MAX_BYTES / 4 + 1);
    expect(isOversizedMessageText(emoji)).toBe(true);
    const emojiGot = parseMessageSend({ threadId: THREAD, content: emoji });
    expect(emojiGot.ok).toBe(false);
    if (!emojiGot.ok) expect(emojiGot.message).toBe(messageSendTooLargeMessage());
  });

  test("limit copy is Russian and names kibibytes", () => {
    expect(formatMessageSendLimit(MESSAGE_SEND_MAX_BYTES)).toBe("64 КБ");
    expect(messageSendTooLargeMessage()).toBe(
      "Сообщение слишком длинное (максимум 64 КБ)",
    );
  });
});

describe("composer size UI", () => {
  test("short draft can send, hides the counter, no error", () => {
    const ui = composerSizeUi("Запиши мысль про маяк");
    expect(ui.oversized).toBe(false);
    expect(ui.disableSend).toBe(false);
    expect(ui.error).toBeNull();
    expect(ui.showCount).toBe(false);
    expect(ui.bytes).toBeLessThan(MESSAGE_SEND_COUNT_NEAR_BYTES);
  });

  test("near the cap shows a Russian count but still allows send", () => {
    const used = MESSAGE_SEND_MAX_BYTES - MESSAGE_SEND_COUNT_NEAR_BYTES;
    const ui = composerSizeUi("a".repeat(used));
    expect(ui.oversized).toBe(false);
    expect(ui.disableSend).toBe(false);
    expect(ui.error).toBeNull();
    expect(ui.showCount).toBe(true);
    expect(ui.countLabel).toBe(
      formatComposerByteCount(used, MESSAGE_SEND_MAX_BYTES),
    );
    expect(ui.countLabel).toMatch(/КБ/);
    expect(formatComposerByteCount(MESSAGE_SEND_MAX_BYTES)).toBe("64 / 64 КБ");
  });

  test("over the cap disables send with the same RU copy as socket error", () => {
    const over = "a".repeat(MESSAGE_SEND_MAX_BYTES + 1);
    const parsed = parseMessageSend({ threadId: THREAD, content: over });
    expect(parsed.ok).toBe(false);
    const socketMessage = parsed.ok ? "" : parsed.message;
    const ui = composerSizeUi(over, socketMessage);
    expect(ui.oversized).toBe(true);
    expect(ui.disableSend).toBe(true);
    expect(ui.showCount).toBe(true);
    expect(ui.error).toBe(messageSendTooLargeMessage());
    expect(ui.error).toBe(socketMessage);
    expect(ui.error).toMatch(/[А-Яа-яЁё]/);
    expect(isMessageSendTooLargeError(socketMessage)).toBe(true);
  });

  test("empty draft still shows the socket error event copy", () => {
    const socket = messageSendTooLargeMessage();
    const ui = composerSizeUi("", socket);
    expect(ui.oversized).toBe(false);
    expect(ui.disableSend).toBe(false);
    expect(ui.error).toBe(socket);
    expect(isMessageSendTooLargeError(ui.error)).toBe(true);
  });

  test("other socket errors do not become the oversize field error", () => {
    const ui = composerSizeUi("привет", "Диалог не найден");
    expect(ui.error).toBeNull();
    expect(ui.disableSend).toBe(false);
    expect(isMessageSendTooLargeError("Диалог не найден")).toBe(false);
    expect(isMessageSendTooLargeError(null)).toBe(false);
  });

  test("textarea char cap sits just above 64 KiB so ASCII can trip the error", () => {
    expect(COMPOSER_TEXTAREA_MAX_CHARS).toBe(MESSAGE_SEND_MAX_BYTES + 1);
    expect(
      utf8ByteLength("a".repeat(COMPOSER_TEXTAREA_MAX_CHARS)),
    ).toBeGreaterThan(MESSAGE_SEND_MAX_BYTES);
  });

  test("Cyrillic count uses UTF-8 bytes, not JS string length", () => {
    const over = "я".repeat(MESSAGE_SEND_MAX_BYTES / 2 + 1);
    const ui = composerSizeUi(over);
    expect(over.length).toBeLessThan(MESSAGE_SEND_MAX_BYTES);
    expect(ui.bytes).toBeGreaterThan(MESSAGE_SEND_MAX_BYTES);
    expect(ui.disableSend).toBe(true);
    expect(ui.error).toBe(messageSendTooLargeMessage());
  });
});
