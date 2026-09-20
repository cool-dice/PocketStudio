import { describe, expect, test } from "bun:test";

import { consumeRateLimit, resetRateLimit } from "./rate-limit";

describe("consumeRateLimit", () => {
  test("allows up to the limit then blocks until the window", () => {
    resetRateLimit("t1");
    const t0 = 1_000_000;
    expect(consumeRateLimit("t1", 3, 60_000, t0).ok).toBe(true);
    expect(consumeRateLimit("t1", 3, 60_000, t0 + 1).ok).toBe(true);
    expect(consumeRateLimit("t1", 3, 60_000, t0 + 2).ok).toBe(true);
    const blocked = consumeRateLimit("t1", 3, 60_000, t0 + 3);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(consumeRateLimit("t1", 3, 60_000, t0 + 60_000).ok).toBe(true);
  });
});
