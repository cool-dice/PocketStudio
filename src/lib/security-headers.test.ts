import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";

import { proxy } from "../proxy";
import {
  SECURITY_HEADERS,
  applySecurityHeaders,
  cspBlocksMonacoOrSocket,
} from "./security-headers";

function headerBag(): Headers {
  const headers = new Headers();
  applySecurityHeaders(headers);
  return headers;
}

describe("security headers", () => {
  test("sets nosniff, referrer, and SAMEORIGIN framing", () => {
    const headers = headerBag();
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(headers.get("x-frame-options")).not.toBe("DENY");
  });

  test("CSP only allows same-origin ancestors (preview iframe)", () => {
    const csp = headerBag().get("content-security-policy");
    expect(csp).toBe("frame-ancestors 'self'");
    expect(csp).not.toMatch(/frame-ancestors\s+'none'/i);
    expect(cspBlocksMonacoOrSocket(csp)).toBe(false);
    expect(cspBlocksMonacoOrSocket("default-src 'self'")).toBe(true);
    expect(cspBlocksMonacoOrSocket("script-src 'self'; connect-src *")).toBe(
      true,
    );
  });

  test("proxy stamps the same headers on a Next response", () => {
    const res = proxy(new NextRequest("http://localhost/w/abc"));
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(key)).toBe(value);
    }
    expect(cspBlocksMonacoOrSocket(res.headers.get("content-security-policy"))).toBe(
      false,
    );
  });
});
