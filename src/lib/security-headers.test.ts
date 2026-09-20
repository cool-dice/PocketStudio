import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";

import nextConfig from "../../next.config";
import { proxy } from "../proxy";
import {
  API_NOINDEX_HEADER_NAME,
  API_NOINDEX_HEADER_VALUE,
  API_NOINDEX_HEADERS,
  SECURITY_HEADERS,
  apiNoindexHeaderList,
  applySecurityHeaders,
  cspBlocksMonacoOrSocket,
  isApiPathname,
} from "./security-headers";

function headerBag(pathname?: string): Headers {
  const headers = new Headers();
  applySecurityHeaders(headers, pathname);
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
    expect(headers.get("x-robots-tag")).toBeNull();
    expect(headers.get("access-control-allow-origin")).toBeNull();
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
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("X-Robots-Tag on /api/", () => {
  test("matches /api and /api/* only", () => {
    expect(isApiPathname("/api")).toBe(true);
    expect(isApiPathname("/api/")).toBe(true);
    expect(isApiPathname("/api/health")).toBe(true);
    expect(isApiPathname("/api/health?ready=1")).toBe(true);
    expect(isApiPathname("/apiary")).toBe(false);
    expect(isApiPathname("/w/api")).toBe(false);
    expect(isApiPathname("/")).toBe(false);
    expect(isApiPathname("/login")).toBe(false);
  });

  test("proxy stamps noindex on public /api/health, not on HTML", () => {
    const health = proxy(new NextRequest("http://localhost/api/health"));
    expect(health.headers.get("x-robots-tag")).toBe("noindex");
    expect(health.headers.get(API_NOINDEX_HEADER_NAME)).toBe(
      API_NOINDEX_HEADER_VALUE,
    );
    expect(health.headers.get("access-control-allow-origin")).toBeNull();
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      expect(health.headers.get(key)).toBe(value);
    }

    expect(proxy(new NextRequest("http://localhost/")).headers.get("x-robots-tag")).toBeNull();
    expect(
      proxy(new NextRequest("http://localhost/login")).headers.get("x-robots-tag"),
    ).toBeNull();
  });

  test("does not invent CORS and does not strip existing Access-Control-*", () => {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "https://studio.example",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Authorization",
    });
    applySecurityHeaders(headers, "/api/health");
    expect(headers.get("x-robots-tag")).toBe("noindex");
    expect(headers.get("access-control-allow-origin")).toBe(
      "https://studio.example",
    );
    expect(headers.get("access-control-allow-methods")).toBe("GET,OPTIONS");
    expect(headers.get("access-control-allow-headers")).toBe("Authorization");
    expect(API_NOINDEX_HEADERS).not.toHaveProperty("Access-Control-Allow-Origin");
    expect(SECURITY_HEADERS).not.toHaveProperty("Access-Control-Allow-Origin");
  });

  test("next.config adds X-Robots-Tag only under /api/:path*", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const api = rules.filter((rule) => rule.source.includes("/api"));
    expect(api.length).toBeGreaterThan(0);
    expect(api.flatMap((rule) => rule.headers)).toEqual(
      expect.arrayContaining(apiNoindexHeaderList),
    );
    const html = rules.filter((rule) => !rule.source.includes("/api"));
    for (const rule of html) {
      expect(
        rule.headers.some((header) => header.key === API_NOINDEX_HEADER_NAME),
      ).toBe(false);
    }
  });
});
