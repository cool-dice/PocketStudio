import { describe, expect, test } from "bun:test";

import {
  ABORT_MESSAGE,
  abortError,
  abortedToolResult,
  decideAfterTool,
  isAbortFlag,
  mergeAbortSignals,
  sleepAbortable,
  throwIfAborted,
  toolCallCommitted,
  toolResultWasAborted,
} from "./abort-flag";

describe("abort flag", () => {
  test("isAbortFlag matches AbortError, 499, and Russian stop text", () => {
    expect(isAbortFlag(abortError())).toBe(true);
    expect(isAbortFlag({ name: "AbortError" })).toBe(true);
    expect(isAbortFlag({ status: 499 })).toBe(true);
    expect(isAbortFlag({ message: ABORT_MESSAGE })).toBe(true);
    expect(isAbortFlag(new Error("сеть"))).toBe(false);
    expect(isAbortFlag(null)).toBe(false);
  });

  test("throwIfAborted is a no-op until the signal fires", () => {
    const ac = new AbortController();
    throwIfAborted(ac.signal);
    throwIfAborted(undefined);
    ac.abort();
    expect(() => throwIfAborted(ac.signal)).toThrow(ABORT_MESSAGE);
  });

  test("aborted tool result is not a committed write", () => {
    const aborted = abortedToolResult();
    expect(toolResultWasAborted(aborted)).toBe(true);
    expect(toolCallCommitted(aborted)).toBe(false);
    expect(toolCallCommitted({ path: "a.ts", size: 12 })).toBe(true);
    expect(toolCallCommitted({ error: "нет файла" })).toBe(false);
  });

  test("abort before a tool commits just stops the loop", () => {
    expect(
      decideAfterTool({
        signalAborted: true,
        result: abortedToolResult(),
      }),
    ).toBe("stop");
    expect(
      decideAfterTool({
        signalAborted: true,
        result: { error: "ещё читаю" },
      }),
    ).toBe("stop");
  });

  test("abort after a committed write keeps the write and stops", () => {
    expect(
      decideAfterTool({
        signalAborted: true,
        result: { path: "index.ts", size: 40, created: true },
      }),
    ).toBe("stop-keep-writes");
  });

  test("a live successful tool continues the loop", () => {
    expect(
      decideAfterTool({
        signalAborted: false,
        result: { hits: [] },
      }),
    ).toBe("continue");
  });

  test("mergeAbortSignals aborts when the turn signal fires", async () => {
    const turn = new AbortController();
    const timeout = AbortSignal.timeout(30_000);
    const merged = mergeAbortSignals([timeout, turn.signal]);
    expect(merged.aborted).toBe(false);
    turn.abort();
    expect(merged.aborted).toBe(true);
  });

  test("sleepAbortable rejects when aborted mid-wait", async () => {
    const ac = new AbortController();
    const pending = sleepAbortable(5_000, ac.signal);
    ac.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});
