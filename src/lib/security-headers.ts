/**
 * Conservative headers on every Next response.
 *
 * Preview HTML is iframed same-origin (`sandbox` + `allow-same-origin`),
 * so framing is SAMEORIGIN / `frame-ancestors 'self'` — not DENY.
 * CSP is framing-only: no `script-src` / `connect-src` / `default-src`,
 * which would break Monaco workers and socket.io.
 *
 * `X-Robots-Tag: noindex` is API-only so a crawler that ignores robots.txt
 * does not index JSON. Public HTML (`/`, `/login`) stays indexable.
 * `Cache-Control: no-store` is also API-only so browsers/proxies do not
 * cache user JSON. HTML is not opted out of caching here.
 * Access-Control-* is never set or deleted here (CORS / health stay intact).
 */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self'",
};

export const API_NOINDEX_HEADER_NAME = "X-Robots-Tag";
export const API_NOINDEX_HEADER_VALUE = "noindex";

export const API_NOINDEX_HEADERS: Record<string, string> = {
  [API_NOINDEX_HEADER_NAME]: API_NOINDEX_HEADER_VALUE,
};

export const API_NO_STORE_HEADER_NAME = "Cache-Control";
export const API_NO_STORE_HEADER_VALUE = "no-store";

export const API_NO_STORE_HEADERS: Record<string, string> = {
  [API_NO_STORE_HEADER_NAME]: API_NO_STORE_HEADER_VALUE,
};

export const securityHeaderList = Object.entries(SECURITY_HEADERS).map(
  ([key, value]) => ({ key, value }),
);

export const apiNoindexHeaderList = Object.entries(API_NOINDEX_HEADERS).map(
  ([key, value]) => ({ key, value }),
);

export const apiNoStoreHeaderList = Object.entries(API_NO_STORE_HEADERS).map(
  ([key, value]) => ({ key, value }),
);

/** `/api` and `/api/...` — not `/apiary` or `/w/api`. Query/hash ignored. */
export function isApiPathname(pathname: string): boolean {
  const noHash = pathname.split("#")[0] ?? pathname;
  const raw = (noHash.split("?")[0] || "/").trim() || "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const normalized =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return normalized === "/api" || normalized.startsWith("/api/");
}

export function applyApiNoindexHeader(headers: Headers): void {
  headers.set(API_NOINDEX_HEADER_NAME, API_NOINDEX_HEADER_VALUE);
}

export function applyApiNoStoreHeader(headers: Headers): void {
  headers.set(API_NO_STORE_HEADER_NAME, API_NO_STORE_HEADER_VALUE);
}

export function applySecurityHeaders(
  headers: Headers,
  pathname?: string,
): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  if (pathname !== undefined && isApiPathname(pathname)) {
    applyApiNoindexHeader(headers);
    applyApiNoStoreHeader(headers);
  }
}

/** True when a CSP would block Monaco workers or socket.io handshakes. */
export function cspBlocksMonacoOrSocket(csp: string | null): boolean {
  if (!csp) return false;
  return /(?:^|;)\s*(?:script-src|connect-src|default-src|worker-src)\b/i.test(
    csp,
  );
}
