import { NextResponse, type NextRequest } from "next/server";

import { oversizedJsonResponse } from "@/lib/json-body-limit";
import { applySecurityHeaders } from "@/lib/security-headers";
import {
  AGENT_SOCKET_INTERNAL_PATH,
  AGENT_SOCKET_PATH,
  isAgentSocketPath,
} from "@/lib/agent-socket";

/**
 * Next.js 16 request proxy (formerly middleware). Stamps basic security
 * headers on the outgoing response without rewriting the request.
 * `/api/*` also gets `X-Robots-Tag: noindex` and `Cache-Control: no-store`.
 * JSON POST/PUT/PATCH over the path cap is 413 (multipart/voice/upload
 * and large studio patches have higher limits). CORS headers are not touched.
 *
 * Bare `/socket.io` is rewritten to `/api/agent-socket` (next.config rewrite
 * to `/socket.io/` hangs). `/socket.io/` continues to the App Router route
 * so long-polling can use maxDuration. Engine.IO POSTs are not JSON-capped.
 */
export function proxy(request: NextRequest): NextResponse {
  const path = request.nextUrl.pathname;
  if (path === AGENT_SOCKET_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = AGENT_SOCKET_INTERNAL_PATH;
    return NextResponse.rewrite(url);
  }
  if (isAgentSocketPath(path)) {
    return NextResponse.next();
  }
  const blocked = oversizedJsonResponse(request, request.nextUrl.pathname);
  const response = blocked ?? NextResponse.next();
  applySecurityHeaders(response.headers, request.nextUrl.pathname);
  return response;
}

export const config = {
  // Compile-time literal required by Next.js; keep in sync with PROXY_MATCHER.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
