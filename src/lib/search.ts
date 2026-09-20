/**
 * Global ⌘P search helpers — case-insensitive ASCII + Cyrillic matching
 * (JS toLowerCase, not SQL LIKE) and a bounded excerpt around the hit.
 * Hits are title + snippet only; never dump chapter bodies, entity
 * descriptions, or artifact prompts.
 */

import type {
  SearchArtifactHit,
  SearchDocumentHit,
  SearchEntityHit,
  SearchResults,
} from "@/lib/types";

export const SEARCH_MIN_QUERY = 2;
export const SEARCH_PER_GROUP = 5;
export const SEARCH_SNIPPET_RADIUS = 40;

/** Workspace types that expose the documents module (see WORKSPACE_TABS_BY_TYPE). */
const DOCUMENTS_TAB_TYPES = new Set(["book", "film", "music", "universal"]);
/** Workspace types that expose the images module. */
const IMAGES_TAB_TYPES = new Set(["film", "universal"]);
const IMAGE_ARTIFACT_KINDS = new Set(["image", "illustration", "concept"]);

/** Case-insensitive substring test (honest for ASCII and Cyrillic). */
export function searchMatches(
  haystack: string | null | undefined,
  needle: string,
): boolean {
  if (!haystack) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

/** Short preview around the first match, with ellipses when trimmed. */
export function searchExcerpt(text: string, needle: string, radius = 42): string {
  const lowerNeedle = needle.toLowerCase();
  const idx = text.toLowerCase().indexOf(lowerNeedle);
  if (idx < 0) return text.slice(0, radius * 2).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + lowerNeedle.length + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Bounded snippet from an optional blurb; falls back to kind/title. */
export function searchSnippet(
  text: string | null | undefined,
  needle: string,
  fallback: string,
): string {
  if (!text) return fallback;
  return searchExcerpt(text, needle, SEARCH_SNIPPET_RADIUS);
}

export function emptySearchResults(): SearchResults {
  return {
    threads: [],
    notes: [],
    projects: [],
    documents: [],
    entities: [],
    artifacts: [],
    total: 0,
  };
}

export function searchTotal(results: SearchResults): number {
  return (
    results.threads.length +
    results.notes.length +
    results.projects.length +
    results.documents.length +
    results.entities.length +
    results.artifacts.length
  );
}

export function documentSearchHref(projectId: string, docId: string): string {
  return `/w/${projectId}?tab=documents&doc=${docId}`;
}

/** Documents module holds entities; app has no such tab → workspace + query. */
export function entitySearchHref(
  projectId: string,
  name: string,
  workspaceType: string,
): string {
  const qs = new URLSearchParams();
  if (DOCUMENTS_TAB_TYPES.has(workspaceType)) qs.set("tab", "documents");
  qs.set("q", name);
  return `/w/${projectId}?${qs.toString()}`;
}

export function artifactSearchHref(
  projectId: string,
  kind: string,
  workspaceType: string,
): string {
  if (IMAGE_ARTIFACT_KINDS.has(kind) && IMAGES_TAB_TYPES.has(workspaceType)) {
    return `/w/${projectId}?tab=images`;
  }
  return "/?area=library";
}

export function mapDocumentHits(
  rows: Array<{
    id: string;
    title: string;
    kind: string;
    projectId: string;
  }>,
  needle: string,
): SearchDocumentHit[] {
  return rows
    .filter((row) => searchMatches(row.title, needle))
    .slice(0, SEARCH_PER_GROUP)
    .map((row) => ({
      id: row.id,
      title: row.title,
      snippet: row.kind,
      kind: row.kind,
      projectId: row.projectId,
      href: documentSearchHref(row.projectId, row.id),
    }));
}

export function mapEntityHits(
  rows: Array<{
    id: string;
    name: string;
    kind: string;
    short: string | null;
    projectId: string;
    workspaceType: string;
  }>,
  needle: string,
): SearchEntityHit[] {
  return rows
    .filter((row) => searchMatches(row.name, needle))
    .slice(0, SEARCH_PER_GROUP)
    .map((row) => ({
      id: row.id,
      name: row.name,
      snippet: searchSnippet(row.short, needle, row.kind),
      kind: row.kind,
      projectId: row.projectId,
      href: entitySearchHref(row.projectId, row.name, row.workspaceType),
    }));
}

export function mapArtifactHits(
  rows: Array<{
    id: string;
    title: string;
    type: string;
    projectId: string;
    workspaceType: string;
  }>,
  needle: string,
): SearchArtifactHit[] {
  return rows
    .filter(
      (row) => searchMatches(row.title, needle) || searchMatches(row.type, needle),
    )
    .slice(0, SEARCH_PER_GROUP)
    .map((row) => ({
      id: row.id,
      title: row.title,
      snippet: row.type,
      kind: row.type,
      projectId: row.projectId,
      href: artifactSearchHref(row.projectId, row.type, row.workspaceType),
    }));
}
