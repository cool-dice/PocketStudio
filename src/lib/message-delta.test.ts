import { describe, expect, test } from "bun:test";

import { applyMessageDelta } from "./message-delta";
import type { ChatMessage } from "./types";

function msg(partial: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    threadId: "t1",
    role: "assistant",
    content: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("applyMessageDelta", () => {
  test("appends tokens to the live bubble without waiting for message:end", () => {
    const start = [msg({ id: "m1", content: "", streaming: true })];
    const afterFirst = applyMessageDelta(
      start,
      { threadId: "t1", messageId: "m1", delta: "При" },
      "t1",
    );
    const afterSecond = applyMessageDelta(
      afterFirst,
      { threadId: "t1", messageId: "m1", delta: "вет" },
      "t1",
    );
    expect(afterSecond[0]?.content).toBe("Привет");
    expect(afterSecond[0]?.streaming).toBe(true);
  });

  test("creates the bubble on the first delta if the user switched back", () => {
    const next = applyMessageDelta(
      [],
      { threadId: "t1", messageId: "m9", delta: "Hel" },
      "t1",
    );
    expect(next).toHaveLength(1);
    expect(next[0]?.content).toBe("Hel");
    expect(next[0]?.streaming).toBe(true);
  });

  test("ignores deltas for a thread that is not active", () => {
    const start = [msg({ id: "m1", content: "x" })];
    const next = applyMessageDelta(
      start,
      { threadId: "other", messageId: "m1", delta: "nope" },
      "t1",
    );
    expect(next).toBe(start);
  });
});
