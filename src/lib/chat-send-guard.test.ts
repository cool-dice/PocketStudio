import { describe, expect, test } from "bun:test";

import {
  isEmptyAssistantBubble,
  shouldBlockSend,
  shouldKeepBusyOnSocketError,
} from "./chat-send-guard";

describe("chat send guard", () => {
  test("blocks double-submit while a send is already in flight", () => {
    expect(
      shouldBlockSend({ sending: true, busy: false, aborting: false }),
    ).toBe(true);
  });

  test("blocks send while the agent is busy or aborting", () => {
    expect(
      shouldBlockSend({ sending: false, busy: true, aborting: false }),
    ).toBe(true);
    expect(
      shouldBlockSend({ sending: false, busy: false, aborting: true }),
    ).toBe(true);
    expect(
      shouldBlockSend({ sending: false, busy: false, aborting: false }),
    ).toBe(false);
  });

  test("keeps the composer locked when the server says the turn is still running", () => {
    expect(shouldKeepBusyOnSocketError("Агент ещё отвечает…")).toBe(true);
    expect(shouldKeepBusyOnSocketError("Нет соединения")).toBe(false);
  });

  test("empty streaming assistant bubbles are the ones to drop on abort", () => {
    expect(
      isEmptyAssistantBubble({
        role: "assistant",
        streaming: true,
        content: "",
      }),
    ).toBe(true);
    expect(
      isEmptyAssistantBubble({
        role: "assistant",
        streaming: true,
        content: "Привет",
      }),
    ).toBe(false);
    expect(
      isEmptyAssistantBubble({ role: "user", content: "" }),
    ).toBe(false);
  });
});
