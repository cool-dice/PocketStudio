/**
 * public/gen helpers — generated images/audio/video served at /gen/<uuid>.ext
 */

import fs from "node:fs";
import path from "node:path";

const GEN_DIR = path.join(process.cwd(), "public", "gen");
const GEN_NAME = /^[a-zA-Z0-9._-]+$/;

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
