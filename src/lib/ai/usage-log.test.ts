import { describe, expect, test } from "bun:test";

import type { ChatUsage, ResolvedRoute } from "./connector";
import {
  chatUsageMeta,
  recordChatUsage,
  shouldRecordUsage,
} from "./usage-log";

const route: ResolvedRoute = {
  toolId: "agent",
  provider: {
    id: "p-openai",
    kind: "openai_compatible",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "sk-test",
    extraHeaders: null,
    isPlatform: true,
    markupPercent: 20,
    markupMultiplier: null,
  },
  model: {
    id: "m1",
    modelId: "gpt-4o-mini",
    displayName: "GPT-4o mini",
    capChat: true,
    capImage: true,
    capTts: true,
    capAsr: true,
    capEmbeddings: false,
  },
};

const usage: ChatUsage = {
  tokensIn: 4,
  tokensOut: 5,
  billableTokensOut: 6,
};

describe("recordChatUsage", () => {
  test("skips empty usage so streamed turns without a usage frame stay quiet", () => {
    expect(
      shouldRecordUsage({
        tokensIn: null,
        tokensOut: null,
        billableTokensOut: null,
      }),
    ).toBe(false);
    expect(shouldRecordUsage(usage)).toBe(true);
  });

  test("writes tokensIn/out and billableTokensOut for a streamed turn", async () => {
    const writes: unknown[] = [];
    await recordChatUsage(
      {
        auditLog: {
          create: async (args) => {
            writes.push(args.data);
            return {};
          },
        },
      },
      { userId: "u1", toolId: "agent", route, usage },
    );
    expect(writes).toHaveLength(1);
    const row = writes[0] as { action: string; meta: string };
    expect(row.action).toBe("ai.usage");
    const meta = JSON.parse(row.meta) as Record<string, unknown>;
    expect(meta.tokensIn).toBe(4);
    expect(meta.tokensOut).toBe(5);
    expect(meta.billableTokensOut).toBe(6);
    expect(meta.streamed).toBe(true);
    expect(chatUsageMeta(route, usage).modelId).toBe("gpt-4o-mini");
  });
});
