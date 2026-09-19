/**
 * Compact/normalize helpers for entity attributes (JSON column),
 * tags (JSON column) and related ids (EntityLink rows).
 */

import type { EntityAttribute } from "@/lib/workspace-types";

export const MAX_ENTITY_ATTRIBUTES = 20;
export const MAX_ENTITY_TAGS = 12;
export const MAX_ENTITY_LINKS = 24;

export function compactAttributes(
  attrs: EntityAttribute[] | undefined,
): EntityAttribute[] {
  const out: EntityAttribute[] = [];
  for (const row of attrs ?? []) {
    const label = String(row.label ?? "").trim().slice(0, 60);
    const value = String(row.value ?? "").trim().slice(0, 300);
    if (!label && !value) continue;
    out.push({ label, value });
    if (out.length >= MAX_ENTITY_ATTRIBUTES) break;
  }
  return out;
}

export function compactTags(tags: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of tags ?? []) {
    const tag = String(raw ?? "")
      .trim()
      .replace(/^#+/, "")
      .slice(0, 40);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_ENTITY_TAGS) break;
  }
  return out;
}

export function uniqueRelated(
  ids: string[] | undefined,
  selfId: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids ?? []) {
    const id = String(raw ?? "").trim();
    if (!id || id === selfId || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= MAX_ENTITY_LINKS) break;
  }
  return out;
}

export function relatedFromLinks(
  from: { toId: string }[],
  to: { fromId: string }[] = [],
): string[] {
  return uniqueRelated(
    [...from.map((l) => l.toId), ...to.map((l) => l.fromId)],
    "",
  );
}

export function sameAttributes(
  a: EntityAttribute[],
  b: EntityAttribute[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (row, i) => row.label === b[i]!.label && row.value === b[i]!.value,
  );
}

export function sameStringList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((id) => set.has(id));
}
