/**
 * Global ⌘P search helpers — case-insensitive ASCII + Cyrillic matching
 * (JS toLowerCase, not SQL LIKE) and a bounded excerpt around the hit.
 */

import type { SearchResults } from "@/lib/types";

export const SEARCH_MIN_QUERY = 2;
export const SEARCH_PER_GROUP = 5;

/** Case-insensitive substring test (honest for ASCII and Cyrillic). */
export function searchMatches(
  haystack: string | null | undefined,
  needle: string,
): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle);
}

/** Short preview around the first match, with ellipses when trimmed. */
export function searchExcerpt(text: string, needle: string, radius = 42): string {
  const idx = text.toLowerCase().indexOf(needle);
  if (idx < 0) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + needle.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

export function emptySearchResults(): SearchResults {
  return { threads: [], notes: [], projects: [], total: 0 };
}

export function searchTotal(results: SearchResults): number {
  return results.threads.length + results.notes.length + results.projects.length;
}
