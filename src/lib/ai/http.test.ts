import { describe, expect, test } from "bun:test";

import { GatewayError } from "./errors";
import { fetchWithTimeout } from "./http";

describe("fetchWithTimeout abort", () => {
  test("turn abort wins over the timeout and returns 499", async () => {
    const ac = new AbortController();
    const original = globalThis.fetch;
    globalThis.fetch = ((_url, init) =>
      new Promise((_, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
          return;
        }
        signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      })) as typeof fetch;
    try {
      const pending = fetchWithTimeout(
        "https://example.invalid/v1/models",
        { method: "GET", signal: ac.signal },
        30_000,
      );
      ac.abort();
      try {
        await pending;
        throw new Error("expected abort");
      } catch (err) {
        expect(err).toBeInstanceOf(GatewayError);
        expect((err as GatewayError).status).toBe(499);
        expect((err as GatewayError).message).toBe("Генерация остановлена");
      }
    } finally {
      globalThis.fetch = original;
    }
  });
});
