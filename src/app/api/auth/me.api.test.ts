import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";

import { applySecurityHeaders } from "@/lib/security-headers";
import { proxy } from "@/proxy";

import { GET as authMe } from "./me/route";

describe("GET /api/auth/me", () => {
  test("unauthenticated 401 includes Cache-Control no-store", async () => {
    const stamped = proxy(new NextRequest("http://localhost/api/auth/me"));
    expect(stamped.headers.get("cache-control")).toBe("no-store");
    expect(stamped.headers.get("x-robots-tag")).toBe("noindex");
    expect(stamped.headers.get("access-control-allow-origin")).toBeNull();

    const res = await authMe(new Request("http://localhost/api/auth/me"));
    expect(res.status).toBe(401);
    applySecurityHeaders(res.headers, "/api/auth/me");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const json = (await res.json()) as { error?: string; user?: unknown };
    expect(json.user).toBeUndefined();
    expect(json.error).toBe("Требуется авторизация");
  });
});
