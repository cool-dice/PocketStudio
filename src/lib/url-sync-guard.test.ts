import { describe, expect, test } from "bun:test";

import { createUrlSyncGuard } from "./url-sync-guard";

describe("createUrlSyncGuard", () => {
  test("skips the next URL apply after a store-driven replace", () => {
    const g = createUrlSyncGuard();
    expect(g.consumeSkip()).toBe(false);
    g.markStoreNav();
    expect(g.consumeSkip()).toBe(true);
    expect(g.consumeSkip()).toBe(false);
  });
});
