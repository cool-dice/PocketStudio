/**
 * AES-256-GCM envelope for provider API keys.
 * Key material = SHA-256(AUTH_SECRET). Prefix `enc:v1:` marks ciphertext.
 * Unprefixed values are treated as legacy plaintext (read-through).
 *
 * Shared-safe: no "@/..." aliases.
 */

import crypto from "node:crypto";

const PREFIX = "enc:v1:";

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET || "vf-dev-secret-change-me";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored;
  const rest = stored.slice(PREFIX.length);
  const [ivB64, tagB64, dataB64] = rest.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Некорректный зашифрованный ключ");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

export function isEncryptedSecret(stored: string): boolean {
  return stored.startsWith(PREFIX);
}

export function last4OfKey(plain: string): string {
  const trimmed = plain.trim();
  if (trimmed.length <= 4) return trimmed;
  return trimmed.slice(-4);
}

export function maskApiKey(last4: string): string {
  if (!last4) return "••••";
  return `sk-...${last4}`;
}
