/**
 * Keyword ranking helpers used by RAG fallback (same user/project filters
 * as vector search). Cyrillic-safe substring match.
 */

export type CanonHitKind = "note" | "section" | "entity";

export interface CanonHit {
  kind: CanonHitKind;
  id: string;
  title: string;
  excerpt: string;
  workspaceId: string | null;
}

function excerptAround(text: string, needle: string, radius = 90): string {
  const hay = text.replace(/\s+/g, " ").trim();
  const idx = hay.toLowerCase().indexOf(needle.toLowerCase());
  if (idx < 0) return hay.slice(0, radius * 2);
  const start = Math.max(0, idx - radius);
  const end = Math.min(hay.length, idx + needle.length + radius);
  return `${start > 0 ? "…" : ""}${hay.slice(start, end)}${end < hay.length ? "…" : ""}`;
}

export function scoreHaystack(hay: string, terms: string[]): number {
  const lower = hay.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    if (lower.includes(term)) score += 2;
    if (lower.startsWith(term)) score += 1;
  }
  return score;
}

export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}

export function rankCanonHits(
  query: string,
  rows: Array<{
    kind: CanonHitKind;
    id: string;
    title: string;
    body: string;
    workspaceId: string | null;
  }>,
  limit = 8,
): CanonHit[] {
  const terms = tokenizeQuery(query);
  if (terms.length === 0) return [];
  const needle = terms[0]!;
  return rows
    .map((row) => {
      const hay = `${row.title}\n${row.body}`;
      return {
        hit: {
          kind: row.kind,
          id: row.id,
          title: row.title,
          excerpt: excerptAround(row.body || row.title, needle),
          workspaceId: row.workspaceId,
        },
        score: scoreHaystack(hay, terms),
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.hit);
}
