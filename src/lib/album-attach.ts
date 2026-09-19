/**
 * Album attach helpers: which artifact rows belong in the document album,
 * and how to copy one into another workspace without sharing the blob.
 */

import { duplicateGeneratedFile } from "@/lib/gen-files";

export type AlbumKind = "portrait" | "illustration" | "concept";

const ALBUM_KINDS: AlbumKind[] = ["portrait", "illustration", "concept"];
const VISUAL_TYPES = ["image", "portrait", "illustration", "concept"];

export function parseArtifactMeta(
  raw: string | null | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* ignore junk JSON */
  }
  return {};
}

export function albumKindFromMeta(
  raw: string | null | undefined,
): AlbumKind | null {
  const kind = parseArtifactMeta(raw).albumKind;
  if (typeof kind === "string" && (ALBUM_KINDS as string[]).includes(kind)) {
    return kind as AlbumKind;
  }
  return null;
}

/** Source can enter the album: visual type or an explicit albumKind. */
export function isAlbumSourceRow(type: string, meta: string | null): boolean {
  if (VISUAL_TYPES.includes(type)) return true;
  return albumKindFromMeta(meta) !== null;
}

export function albumKindForSource(type: string, meta: string | null): AlbumKind {
  const fromMeta = albumKindFromMeta(meta);
  if (fromMeta) return fromMeta;
  if (type === "portrait") return "portrait";
  if (type === "concept") return "concept";
  return "illustration";
}

export function persistAlbumMeta(
  raw: string | null | undefined,
  kind: AlbumKind,
): string {
  const meta = parseArtifactMeta(raw);
  meta.albumKind = kind;
  return JSON.stringify(meta);
}

export function albumPersistType(kind: AlbumKind): "image" | "portrait" {
  return kind === "portrait" ? "portrait" : "image";
}

/**
 * URL for the copy: duplicate a live /gen blob, keep an external URL,
 * drop a missing /gen path so the copy is not a clickable 404.
 */
export function copiedAlbumUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/gen/")) return duplicateGeneratedFile(url);
  return url;
}
