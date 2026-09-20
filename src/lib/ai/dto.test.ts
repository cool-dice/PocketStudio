import { describe, expect, test } from "bun:test";

import { providerDto } from "./dto";

describe("providerDto", () => {
  test("never returns extraHeaders or raw keys", () => {
    const dto = providerDto({
      id: "p1",
      userId: "u1",
      kind: "openai_compatible",
      name: "Mine",
      baseUrl: "https://api.openai.com/v1",
      apiKeyLast4: "xyz9",
      enabled: true,
      visibleToUsers: true,
      markupPercent: null,
      markupMultiplier: null,
      extraHeaders: JSON.stringify({ Authorization: "Bearer sk-secret-header" }),
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      models: [],
    });
    expect(dto.extraHeaders).toBeNull();
    expect(JSON.stringify(dto)).not.toContain("sk-secret");
    expect(dto.apiKeyMasked).toBe("sk-...xyz9");
  });
});
