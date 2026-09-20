import { describe, expect, test } from "bun:test";

import { encryptSecret, decryptSecret, last4OfKey, maskApiKey } from "./crypto";

describe("crypto envelope", () => {
  test("round-trips a secret", () => {
    const plain = "sk-test-secret-value";
    const stored = encryptSecret(plain);
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(stored)).toBe(plain);
  });

  test("passes through legacy plaintext", () => {
    expect(decryptSecret("sk-legacy")).toBe("sk-legacy");
  });

  test("masks last 4", () => {
    expect(last4OfKey("sk-abcdefgh")).toBe("efgh");
    expect(maskApiKey("efgh")).toBe("sk-...efgh");
  });
});
