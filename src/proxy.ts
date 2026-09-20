import { NextResponse, type NextRequest } from "next/server";

import { applySecurityHeaders } from "@/lib/security-headers";

/**
 * Next.js 16 request proxy (formerly middleware). Stamps basic security
 * headers on the outgoing response without rewriting the request.
 * `/api/*` also gets `X-Robots-Tag: noindex`. CORS headers are not touched.
 */
export function proxy(request: NextRequest): NextResponse {
  const response = NextResponse.next();
  applySecurityHeaders(response.headers, request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
