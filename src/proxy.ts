import { NextResponse, type NextRequest } from "next/server";

import { applySecurityHeaders } from "@/lib/security-headers";

/**
 * Next.js 16 request proxy (formerly middleware). Stamps basic security
 * headers on the outgoing response without rewriting the request.
 */
export function proxy(_request: NextRequest): NextResponse {
  const response = NextResponse.next();
  applySecurityHeaders(response.headers);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
