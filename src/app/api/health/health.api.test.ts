import { describe, expect, test } from "bun:test";
import { NextRequest } from "next/server";

import {
  AGENT_PROBE_KEYS,
  APP_HEALTH_KEYS,
  AUTH_REQUIRED,
  ERROR_ONLY_KEYS,
  jsonLooksLikeSecretLeak,
} from "@/lib/health";
import { applySecurityHeaders } from "@/lib/security-headers";
import { proxy } from "@/proxy";

import { GET as appHealth } from "./route";
import {
  GET as agentHealth,
  POST as agentStart,
} from "./agent-service/route";

function assertNoSecretLeak(json: unknown) {
  const blob = JSON.stringify(json);
  expect(jsonLooksLikeSecretLeak(json)).toBe(false);
  expect(blob).not.toMatch(/DATABASE_URL/);
  expect(blob).not.toMatch(/AUTH_SECRET/);
  expect(blob).not.toMatch(/postgresql:\/\//);
  expect(blob).not.toMatch(/\bat\s+\S+\s+\(/);
}

describe("GET /api/health", () => {
  test("returns only status up/down, no secrets or stacks", async () => {
    const res = await appHealth();
    expect([200, 503]).toContain(res.status);
    const json = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual([...APP_HEALTH_KEYS]);
    expect(json.status === "up" || json.status === "down").toBe(true);
    if (res.status === 200) expect(json.status).toBe("up");
    if (res.status === 503) expect(json.status).toBe("down");
    assertNoSecretLeak(json);
  });

  test("X-Robots-Tag noindex on /api/health without changing JSON or CORS", async () => {
    const stamped = proxy(new NextRequest("http://localhost/api/health"));
    expect(stamped.headers.get("x-robots-tag")).toBe("noindex");
    expect(stamped.headers.get("cache-control")).toBe("no-store");
    expect(stamped.headers.get("access-control-allow-origin")).toBeNull();

    const res = await appHealth();
    applySecurityHeaders(res.headers, "/api/health");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    const json = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual([...APP_HEALTH_KEYS]);
    expect(json.status === "up" || json.status === "down").toBe(true);
    assertNoSecretLeak(json);
  });
});

describe("GET /api/health/agent-service", () => {
  test("returns only up boolean, no secrets or stacks", async () => {
    const res = await agentHealth();
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual([...AGENT_PROBE_KEYS]);
    expect(typeof json.up).toBe("boolean");
    assertNoSecretLeak(json);
  });
});

describe("POST /api/health/agent-service", () => {
  test("unauthenticated error is generic, keys are only error", async () => {
    const res = await agentStart(
      new Request("http://localhost/api/health/agent-service", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(401);
    const json = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual([...ERROR_ONLY_KEYS]);
    expect(json.error).toBe(AUTH_REQUIRED);
    assertNoSecretLeak(json);
  });
});
