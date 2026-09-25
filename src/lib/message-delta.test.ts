import { describe, expect, test } from "bun:test";

import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";

import {
  applyAbortTurn,
  applyMessageDelta,
  applyMessageEnd,
  applyMessageStart,
  dropFailedOptimisticSend,
  mergeTranscriptOnReconnect,
} from "./message-delta";
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

  test("start + delta + end keep a single bubble", () => {
    let rows: ChatMessage[] = [];
    rows = applyMessageStart(rows, { threadId: "t1", messageId: "m1" }, "t1");
    rows = applyMessageDelta(
      rows,
      { threadId: "t1", messageId: "m1", delta: "Hi" },
      "t1",
    );
    rows = applyMessageStart(rows, { threadId: "t1", messageId: "m1" }, "t1");
    rows = applyMessageEnd(
      rows,
      {
        threadId: "t1",
        message: msg({ id: "m1", content: "Hi" }),
      },
      "t1",
    );
    expect(rows.filter((m) => m.id === "m1")).toHaveLength(1);
    expect(rows[0]?.content).toBe("Hi");
    expect(rows[0]?.streaming).toBe(false);
  });

  test("delta before start does not create a second bubble", () => {
    let rows: ChatMessage[] = [];
    rows = applyMessageDelta(
      rows,
      { threadId: "t1", messageId: "m1", delta: "Hi" },
      "t1",
    );
    rows = applyMessageStart(rows, { threadId: "t1", messageId: "m1" }, "t1");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.content).toBe("Hi");
  });

  test("delta after abort is ignored and does not resurrect the bubble", () => {
    const live = [msg({ id: "m1", content: "Hel", streaming: true })];
    const stopped = applyAbortTurn(live);
    const late = applyMessageDelta(
      stopped,
      { threadId: "t1", messageId: "m1", delta: "lo" },
      "t1",
      "t1",
    );
    expect(late[0]?.content).toBe("Hel");
    expect(late[0]?.streaming).toBe(false);
  });

  test("delta after message:end does not append", () => {
    const ended = applyMessageEnd(
      [msg({ id: "m1", content: "Hi", streaming: true })],
      { threadId: "t1", message: msg({ id: "m1", content: "Hi" }) },
      "t1",
    );
    const late = applyMessageDelta(
      ended,
      { threadId: "t1", messageId: "m1", delta: " extra" },
      "t1",
    );
    expect(late[0]?.content).toBe("Hi");
    expect(late[0]?.streaming).toBe(false);
  });

  test("does not crash when content or delta is missing", () => {
    const broken = [{ id: "m1", threadId: "t1", role: "assistant" } as ChatMessage];
    const next = applyMessageDelta(
      broken,
      { threadId: "t1", messageId: "m1", delta: undefined as unknown as string },
      "t1",
    );
    expect(next).toBe(broken);
    const ended = applyMessageEnd(
      broken,
      { threadId: "t1", message: { id: "m1" } as ChatMessage },
      "t1",
    );
    expect(ended[0]?.content).toBe("");
    expect(ended[0]?.streaming).toBe(false);
  });

  test("reconnect keeps live tokens when REST still has an empty row", () => {
    const prev = [
      msg({ id: "u1", role: "user", content: "hi" }),
      msg({ id: "m1", content: "Hel", streaming: true }),
    ];
    const loaded = [
      msg({ id: "u1", role: "user", content: "hi" }),
      msg({ id: "m1", content: "" }),
    ];
    const merged = mergeTranscriptOnReconnect(prev, loaded);
    expect(merged).toHaveLength(2);
    expect(merged[1]?.content).toBe("Hel");
    expect(merged[1]?.streaming).toBe(true);
  });

  test("reconnect keeps a live bubble the REST snapshot has not persisted yet", () => {
    const prev = [msg({ id: "m-live", content: "токен", streaming: true })];
    const merged = mergeTranscriptOnReconnect(prev, []);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("m-live");
  });

  test("unconfigured assistant end is visible and not streaming (composer can type)", () => {
    let rows: ChatMessage[] = [
      msg({ id: "u1", role: "user", content: "Привет" }),
    ];
    rows = applyMessageStart(rows, { threadId: "t1", messageId: "m-err" }, "t1");
    rows = applyMessageDelta(
      rows,
      {
        threadId: "t1",
        messageId: "m-err",
        delta: UNCONFIGURED_TOOL_MESSAGE,
      },
      "t1",
    );
    rows = applyMessageEnd(
      rows,
      {
        threadId: "t1",
        message: msg({
          id: "m-err",
          content: UNCONFIGURED_TOOL_MESSAGE,
        }),
      },
      "t1",
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]?.content).toBe(UNCONFIGURED_TOOL_MESSAGE);
    expect(rows[1]?.content).toMatch(/Администратор ещё не настроил/);
    expect(rows[1]?.streaming).toBe(false);
    expect(rows[1]?.content).not.toMatch(/готово|успешно|я обработал запрос/i);
  });
});

describe("dropFailedOptimisticSend", () => {
  test("rejected send drops the pending user bubble so it cannot hang", () => {
    const rows = [
      msg({ id: "m1", role: "user", content: "старое" }),
      msg({
        id: "temp-1",
        role: "user",
        content: "новое",
        pending: true,
      }),
    ];
    const next = dropFailedOptimisticSend(rows);
    expect(next).toHaveLength(1);
    expect(next[0]?.id).toBe("m1");
    expect(next.some((m) => m.pending)).toBe(false);
  });

  test("confirmed rows are kept even if a later tool is pending", () => {
    const rows = [
      msg({ id: "u1", role: "user", content: "hi", pending: false }),
      msg({ id: "tool-1", role: "tool", content: "", toolPending: true }),
    ];
    expect(dropFailedOptimisticSend(rows)).toEqual(rows);
  });
});
