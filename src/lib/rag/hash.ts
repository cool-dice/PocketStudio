/**
 * Content-hash so we skip re-embed when a source chunk is unchanged.
 */

import { createHash } from "node:crypto";

export function ragContentHash(
  content: string,
  extra: { sourceType: string; sourceId: string; path?: string | null; ordinal: number },
): string {
  return createHash("sha256")
    .update(extra.sourceType)
    .update("\0")
    .update(extra.sourceId)
    .update("\0")
    .update(extra.path ?? "")
    .update("\0")
    .update(String(extra.ordinal))
    .update("\0")
    .update(content)
    .digest("hex")
    .slice(0, 40);
}

export function vectorLiteral(values: number[]): string {
  return `[${values.map((n) => (Number.isFinite(n) ? n.toFixed(8) : "0")).join(",")}]`;
}
