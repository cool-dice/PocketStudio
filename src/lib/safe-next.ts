/**
 * Sanitize `?next=` after login so we never open-redirect.
 * Only same-origin relative paths: `/w/…`, `/?area=…`, `/`.
 */

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  let next = raw.trim();
  try {
    next = decodeURIComponent(next);
  } catch {
    return "/";
  }
  next = next.trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  if (/[\u0000-\u001f\\]/.test(next)) return "/";
  if (next.includes("://")) return "/";
  const pathOnly = next.split("?")[0] ?? next;
  if (pathOnly === "/login" || pathOnly.startsWith("/login/")) return "/";
  return next.slice(0, 512) || "/";
}
