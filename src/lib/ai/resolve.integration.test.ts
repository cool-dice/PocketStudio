import { describe, expect, test } from "bun:test";

import { PrismaClient } from "@prisma/client";

import { encryptSecret, last4OfKey } from "./crypto";
import { GatewayError } from "./errors";
import { assertHttpUrl } from "./http";
import { resolveToolRoute } from "./resolve";
import { UNCONFIGURED_TOOL_MESSAGE } from "./tools";

const db = new PrismaClient();

describe("resolveToolRoute unconfigured", () => {
  test("throws the Russian admin message when no default exists", async () => {
    const user = await db.user.findFirst({ select: { id: true } });
    expect(user).toBeTruthy();
    try {
      await resolveToolRoute(db, user!.id, "image");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(GatewayError);
      expect((err as GatewayError).message).toBe(UNCONFIGURED_TOOL_MESSAGE);
      expect((err as GatewayError).status).toBe(400);
    }
  });
});

describe("provider URL validation", () => {
  test("rejects non-http URLs", () => {
    expect(() => assertHttpUrl("file:///etc/passwd")).toThrow(/http/);
    expect(() => assertHttpUrl("not a url")).toThrow();
  });

  test("accepts OpenAI and Anthropic examples", () => {
    expect(assertHttpUrl("https://api.openai.com/v1")).toContain("https://api.openai.com/v1");
    expect(assertHttpUrl("https://api.anthropic.com")).toContain("https://api.anthropic.com");
  });
});

describe("platform provider CRUD (db)", () => {
  test("creates a provider with encrypted key and masked last4", async () => {
    const row = await db.aiProvider.create({
      data: {
        userId: null,
        kind: "openai_compatible",
        name: "Test OpenAI",
        baseUrl: "https://api.openai.com/v1",
        apiKey: encryptSecret("sk-test-not-real-xyz9"),
        apiKeyLast4: last4OfKey("sk-test-not-real-xyz9"),
        enabled: true,
        visibleToUsers: true,
      },
    });
    expect(row.apiKey.startsWith("enc:v1:")).toBe(true);
    expect(row.apiKey).not.toContain("sk-test-not-real");
    expect(row.apiKeyLast4).toBe("xyz9");
    await db.aiProvider.delete({ where: { id: row.id } });
  });
});
