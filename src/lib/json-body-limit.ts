/**
 * Reject oversized JSON bodies before they sit in memory.
 * `oversizedJsonResponse` uses Content-Length (cheap; no read).
 * `readJsonBody` also counts bytes while reading so chunked requests
 * and a lying/smaller Content-Length still 413.
 * Multipart zip/voice/upload and large studio patches get a higher
 * cap or are skipped — pass the same path cap map to both.
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

export const JSON_BODY_INVALID = "Некорректный JSON в запросе";

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
  return jsonBodyTooLargeResponse(limit);
}

export function jsonBodyTooLargeResponse(limitBytes: number): NextResponse {
  return NextResponse.json(
    { error: jsonBodyTooLargeMessage(limitBytes) },
    { status: 413 },
  );
}

export class JsonBodyTooLargeError extends Error {
  readonly limitBytes: number;
  constructor(limitBytes: number) {
    super(jsonBodyTooLargeMessage(limitBytes));
    this.name = "JsonBodyTooLargeError";
    this.limitBytes = limitBytes;
  }
}

export function isJsonBodyTooLarge(err: unknown): err is JsonBodyTooLargeError {
  return err instanceof JsonBodyTooLargeError;
}

export type JsonBodyRead =
  | { ok: true; value: unknown }
  | { ok: false; response: NextResponse };

function invalidJsonResponse(): NextResponse {
  return NextResponse.json({ error: JSON_BODY_INVALID }, { status: 400 });
}

/**
 * Read the request body as text, stopping at `maxBytes` + 1.
 * Covers missing Content-Length (chunked) and a header smaller than
 * the real body — those are not caught by `oversizedJsonResponse`.
 */
export async function readRequestTextCapped(
  req: Request,
  maxBytes: number,
): Promise<string> {
  const declared = contentLengthBytes(req.headers);
  if (declared != null && declared > maxBytes) {
    if (req.body) await req.body.cancel().catch(() => undefined);
    throw new JsonBodyTooLargeError(maxBytes);
  }

  if (!req.body) {
    const buf = await req.arrayBuffer().catch(() => new ArrayBuffer(0));
    if (buf.byteLength > maxBytes) {
      throw new JsonBodyTooLargeError(maxBytes);
    }
    return new TextDecoder("utf-8").decode(buf);
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new JsonBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof JsonBodyTooLargeError) throw err;
    await reader.cancel().catch(() => undefined);
    throw err;
  }

  if (chunks.length === 0) return "";
  if (chunks.length === 1) {
    return new TextDecoder("utf-8").decode(chunks[0]);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(out);
}

/**
 * Wrap `req.json()` with the same path cap map as `oversizedJsonResponse`.
 * Parse errors: 400, or `fallback` when provided (same as `.catch(() => …)`).
 * Oversize: 413 even when Content-Length is missing or too small.
 */
export async function readJsonBody(
  req: Request,
  options?: { fallback?: unknown; pathname?: string },
): Promise<JsonBodyRead> {
  const pathname = options?.pathname ?? new URL(req.url).pathname;
  const limit = jsonBodyLimitBytes(pathname, req.headers.get("content-type"));
  const hasFallback = options != null && "fallback" in options;

  if (limit == null) {
    try {
      return { ok: true, value: await req.json() };
    } catch {
      if (hasFallback) return { ok: true, value: options.fallback };
      return { ok: false, response: invalidJsonResponse() };
    }
  }

  try {
    const text = await readRequestTextCapped(req, limit);
    if (text.trim() === "") {
      if (hasFallback) return { ok: true, value: options.fallback };
      return { ok: false, response: invalidJsonResponse() };
    }
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (err) {
    if (err instanceof JsonBodyTooLargeError) {
      return { ok: false, response: jsonBodyTooLargeResponse(err.limitBytes) };
    }
    if (hasFallback) return { ok: true, value: options.fallback };
    return { ok: false, response: invalidJsonResponse() };
  }
}
