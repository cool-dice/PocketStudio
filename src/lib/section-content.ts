/**
 * Chapter body cap in characters.
 * HTTP PATCH `/api/sections/[id]` and agent `create_document` /
 * `append_section` share this number. JSON envelopes are a separate
 * 1 MiB map; disk writes stay `MAX_AGENT_FILE_BYTES` (200 KiB).
 */

import { z } from "zod";

export const MAX_SECTION_CONTENT_CHARS = 200_000;

export const sectionContentSchema = z.string().max(MAX_SECTION_CONTENT_CHARS);

/** Agent tool args: trim + slice to the same cap as HTTP. Empty → "". */
export function sectionContentFromToolArg(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.slice(0, MAX_SECTION_CONTENT_CHARS);
}
