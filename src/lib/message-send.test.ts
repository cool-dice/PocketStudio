import { describe, expect, test } from "bun:test";

import {
  MESSAGE_SEND_EMPTY,
  MESSAGE_SEND_INVALID,
  MESSAGE_SEND_MAX_BYTES,
  MESSAGE_SEND_MAX_PACKET_BYTES,
  MESSAGE_SEND_TOO_LARGE,
  formatMessageSendLimit,
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
