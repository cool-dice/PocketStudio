/**
 * public/gen helpers — generated images/audio/video served at /gen/<uuid>.ext
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const GEN_DIR = path.join(process.cwd(), "public", "gen");
const GEN_NAME = /^[a-zA-Z0-9._-]+$/;
const GEN_EXT = /^[a-zA-Z0-9]+$/;

function absForPublicGen(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/gen/")) return null;
  const name = path.basename(url);
  if (!GEN_NAME.test(name)) return null;
  return path.join(GEN_DIR, name);
}

/** Drop clickable /gen/… URLs whose files were already deleted from disk. */
export function publicGenUrlIfExists(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  if (!url.startsWith("/gen/")) return url;
  const abs = absForPublicGen(url);
  if (!abs) return null;
  return fs.existsSync(abs) ? url : null;
}

export function unlinkGeneratedFile(url: string | null | undefined): void {
  const abs = absForPublicGen(url);
  if (!abs) return;
  try {
    fs.unlinkSync(abs);
  } catch {
    // already gone
  }
}

/** Copy a live /gen blob to a new name so album attach does not share the file. */
export function duplicateGeneratedFile(
  url: string | null | undefined,
): string | null {
  const abs = absForPublicGen(url);
  if (!abs || !fs.existsSync(abs)) return null;
  const ext = path.extname(abs).slice(1);
  if (!GEN_EXT.test(ext)) return null;
  if (!fs.existsSync(GEN_DIR)) fs.mkdirSync(GEN_DIR, { recursive: true });
  const destName = `${randomUUID()}.${ext}`;
  fs.copyFileSync(abs, path.join(GEN_DIR, destName));
  return `/gen/${destName}`;
}

/** Null a dead /gen URL and flag it so the client does not render a 404 href. */
export function withLiveGenUrl<T extends { url: string | null }>(
  dto: T,
): T & { fileMissing: boolean } {
  const stored = dto.url;
  const live = publicGenUrlIfExists(stored);
  return {
    ...dto,
    url: live,
    fileMissing: Boolean(stored?.startsWith("/gen/") && live === null),
  };
}
