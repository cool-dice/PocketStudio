import { NextResponse, type NextRequest } from "next/server";

import { oversizedJsonResponse } from "@/lib/json-body-limit";
import { applySecurityHeaders } from "@/lib/security-headers";
import { isAgentSocketPath, PROXY_MATCHER } from "@/lib/agent-socket";

/**
 * Next.js 16 request proxy (formerly middleware). Stamps basic security
 * headers on the outgoing response without rewriting the request.
 * `/api/*` also gets `X-Robots-Tag: noindex` and `Cache-Control: no-store`.
 * JSON POST/PUT/PATCH over the path cap is 413 (multipart/voice/upload
 * and large studio patches have higher limits). CORS headers are not touched.
 * `/socket.io` is skipped (matcher + guard) so the agent rewrite can upgrade.
 */
export function proxy(request: NextRequest): NextResponse {
  if (isAgentSocketPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const blocked = oversizedJsonResponse(request, request.nextUrl.pathname);
  const response = blocked ?? NextResponse.next();
  applySecurityHeaders(response.headers, request.nextUrl.pathname);
  return response;
}

export { PROXY_MATCHER };

export const config = {
  matcher: PROXY_MATCHER,
};
