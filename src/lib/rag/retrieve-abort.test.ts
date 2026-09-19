import { describe, expect, test } from "bun:test";

import { ABORT_MESSAGE } from "../abort-flag";
import { retrieve } from "./retrieve";
import type { PrismaClient } from "@prisma/client";

describe("retrieve abort", () => {
  test("already-aborted signal fails before any DB work", async () => {
    const signal = AbortSignal.abort();
    await expect(
      retrieve({} as PrismaClient, {
        scope: { kind: "global", userId: "u1", projectId: null },
        query: "карие глаза Марины",
        signal,
      }),
    ).rejects.toMatchObject({ message: ABORT_MESSAGE, name: "AbortError" });
  });
});
