/** Relative project paths that must never be deleted (the project root). */
export function isDeletableRelPath(relPath: string): boolean {
  if (typeof relPath !== "string") return false;
  const n = relPath.replace(/\\/g, "/").replace(/^\/+/, "").trim();
  return n.length > 0 && n !== "." && n !== "./";
}
