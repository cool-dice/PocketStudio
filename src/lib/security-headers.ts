/**
 * Conservative headers on every Next response.
 *
 * Preview HTML is iframed same-origin (`sandbox` + `allow-same-origin`),
 * so framing is SAMEORIGIN / `frame-ancestors 'self'` — not DENY.
 * CSP is framing-only: no `script-src` / `connect-src` / `default-src`,
 * which would break Monaco workers and socket.io.
 */

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self'",
};

export const securityHeaderList = Object.entries(SECURITY_HEADERS).map(
  ([key, value]) => ({ key, value }),
);

export function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}

/** True when a CSP would block Monaco workers or socket.io handshakes. */
export function cspBlocksMonacoOrSocket(csp: string | null): boolean {
  if (!csp) return false;
  return /(?:^|;)\s*(?:script-src|connect-src|default-src|worker-src)\b/i.test(
    csp,
  );
}
