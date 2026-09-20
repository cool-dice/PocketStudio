/**
 * Reject oversized JSON bodies before `req.json()`.
 * Uses Content-Length (cheap; no read). Multipart zip/voice/upload and
 * large studio patches get a higher cap or are skipped.
 */

import { NextResponse } from "next/server";

import { isApiPathname } from "@/lib/security-headers";

/** Default JSON POST/PATCH/PUT — notes, auth, admin, most CRUD. */
export const JSON_BODY_LIMIT = 256 * 1024;

/** File save, chapter text, DAW / NLE state. */
export const JSON_BODY_LIMIT_LARGE = 1024 * 1024;

/** Raster preview data-URL (schema allows 2e6 chars) + payload. */
export const JSON_BODY_LIMIT_DESIGN = 3 * 1024 * 1024;

/** Voice ASR (~12 MB audio) and workspace binary upload (~34 MB base64). */
export const JSON_BODY_LIMIT_MEDIA = 36 * 1024 * 1024;

export const JSON_BODY_TOO_LARGE = "Тело запроса слишком большое";

const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

function normalizePathname(pathname: string): string {
  const noHash = pathname.split("#")[0] ?? pathname;
  const raw = (noHash.split("?")[0] || "/").trim() || "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function isMultipart(contentType: string | null): boolean {
  return (contentType ?? "").toLowerCase().includes("multipart/form-data");
}

export function isJsonBodyMethod(method: string): boolean {
  return BODY_METHODS.has(method.toUpperCase());
}

export function formatJsonBodyLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    const label = Number.isInteger(mb) ? String(mb) : mb.toFixed(0);
    return `${label} МБ`;
  }
  return `${Math.round(bytes / 1024)} КБ`;
}

export function jsonBodyTooLargeMessage(limitBytes: number): string {
  return `${JSON_BODY_TOO_LARGE} — максимум ${formatJsonBodyLimit(limitBytes)}`;
}

/**
 * Bytes allowed for this API path, or `null` to skip (multipart has own caps).
 */
export function jsonBodyLimitBytes(
  pathname: string,
  contentType?: string | null,
): number | null {
  if (isMultipart(contentType ?? null)) return null;
  const path = normalizePathname(pathname);
  if (path === "/api/notes/voice") return JSON_BODY_LIMIT_MEDIA;
  if (/^\/api\/workspaces\/[^/]+\/upload$/.test(path)) {
    return JSON_BODY_LIMIT_MEDIA;
  }
  if (/^\/api\/workspaces\/[^/]+\/design$/.test(path)) {
    return JSON_BODY_LIMIT_DESIGN;
  }
  if (/^\/api\/projects\/[^/]+\/file$/.test(path)) {
    return JSON_BODY_LIMIT_LARGE;
  }
  if (/^\/api\/sections\/[^/]+$/.test(path)) return JSON_BODY_LIMIT_LARGE;
  if (/^\/api\/workspaces\/[^/]+\/(daw|timeline)$/.test(path)) {
    return JSON_BODY_LIMIT_LARGE;
  }
  return JSON_BODY_LIMIT;
}

export function contentLengthBytes(headers: Headers): number | null {
  const raw = headers.get("content-length");
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export function oversizedJsonResponse(
  req: Request,
  pathname = new URL(req.url).pathname,
): NextResponse | null {
  if (!isJsonBodyMethod(req.method)) return null;
  if (!isApiPathname(pathname)) return null;
  const limit = jsonBodyLimitBytes(pathname, req.headers.get("content-type"));
  if (limit == null) return null;
  const length = contentLengthBytes(req.headers);
  if (length == null || length <= limit) return null;
  return NextResponse.json(
    { error: jsonBodyTooLargeMessage(limit) },
    { status: 413 },
  );
}
