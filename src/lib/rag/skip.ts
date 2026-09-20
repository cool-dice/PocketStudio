/**
 * Paths that must never be embedded (secrets, vendor, binaries, gen blobs).
 */

const SKIP_DIR_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".cache",
  "vendor",
  "__pycache__",
]);

const SKIP_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "composer.lock",
  "cargo.lock",
  "poetry.lock",
  ".ds_store",
  "thumbs.db",
]);

const SKIP_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "bmp",
  "svg",
  "mp3",
  "wav",
  "ogg",
  "flac",
  "mp4",
  "webm",
  "mov",
  "avi",
  "woff",
  "woff2",
  "ttf",
  "otf",
  "eot",
  "pdf",
  "zip",
  "gz",
  "tgz",
  "7z",
  "rar",
  "wasm",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "db",
  "sqlite",
  "sqlite3",
]);

/** Skip embedding files larger than this (chars ≈ bytes for source). */
export const MAX_INDEX_FILE_BYTES = 200_000;

export function shouldSkipFileBytes(bytes: number): boolean {
  return !Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_INDEX_FILE_BYTES;
}

export function shouldSkipPath(relPath: string): boolean {
  const posix = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!posix) return true;
  const segments = posix.split("/").filter(Boolean);
  if (segments.some((s) => SKIP_DIR_SEGMENTS.has(s))) return true;
  // public/gen blobs (generated images/audio)
  if (segments[0] === "public" && segments[1] === "gen") return true;
  if (segments[0] === "gen") return true;
  const file = segments[segments.length - 1]!.toLowerCase();
  if (SKIP_FILENAMES.has(file)) return true;
  const ext = file.includes(".") ? file.split(".").pop()! : "";
  if (ext && SKIP_EXT.has(ext)) return true;
  return false;
}

export function isProbablyBinary(buf: Buffer): boolean {
  const probe = buf.subarray(0, Math.min(8192, buf.length));
  return probe.includes(0);
}
