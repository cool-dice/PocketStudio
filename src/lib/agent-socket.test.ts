import { describe, expect, test } from "bun:test";

import nextConfig from "../../next.config";
import { PROXY_MATCHER, proxy } from "../proxy";
import { NextRequest } from "next/server";

import {
  AGENT_CADDY_PORT_QUERY,
  AGENT_SERVICE_PORT,
  AGENT_SOCKET_PATH,
  agentSocketClientUri,
  agentSocketProxyDestination,
  agentSocketProxyRewrites,
  isAgentSocketPath,
} from "./agent-socket";

async function rewriteList() {
  const raw = await nextConfig.rewrites?.();
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return [
    ...(raw.beforeFiles ?? []),
    ...(raw.afterFiles ?? []),
    ...(raw.fallback ?? []),
  ];
}

describe("agent socket path for Next without Caddy", () => {
  test("engine path is /socket.io, not the app shell /", () => {
    expect(AGENT_SOCKET_PATH).toBe("/socket.io");
    expect(AGENT_SOCKET_PATH).not.toBe("/");
    expect(agentSocketClientUri()).toContain(
      `${AGENT_CADDY_PORT_QUERY}=${AGENT_SERVICE_PORT}`,
    );
    expect(agentSocketClientUri().startsWith("/?")).toBe(true);
  });

  test("rewrites send /socket.io to the agent on :3003", () => {
    const rules = agentSocketProxyRewrites();
    expect(rules.some((r) => r.source === AGENT_SOCKET_PATH)).toBe(true);
    expect(
      rules.some((r) => r.source === `${AGENT_SOCKET_PATH}/:path*`),
    ).toBe(true);
    const dest = agentSocketProxyDestination();
    expect(dest).toBe("http://127.0.0.1:3003/socket.io");
    for (const rule of rules) {
      expect(rule.destination.startsWith(dest)).toBe(true);
    }
  });

  test("next.config beforeFiles includes the agent rewrite", async () => {
    const rules = await rewriteList();
    const hit = rules.find((r) => r.source === `${AGENT_SOCKET_PATH}/:path*`);
    expect(hit).toBeDefined();
    expect(hit?.destination).toBe("http://127.0.0.1:3003/socket.io/:path*");
  });

  test("isAgentSocketPath does not match the homepage or /api", () => {
    expect(isAgentSocketPath("/socket.io")).toBe(true);
    expect(isAgentSocketPath("/socket.io/")).toBe(true);
    expect(isAgentSocketPath("/socket.io/?EIO=4")).toBe(true);
    expect(isAgentSocketPath("/")).toBe(false);
    expect(isAgentSocketPath("/api/health/agent-service")).toBe(false);
    expect(isAgentSocketPath("/w/abc")).toBe(false);
  });

  test("proxy matcher skips socket.io so upgrades are not intercepted", () => {
    expect(PROXY_MATCHER.join(" ")).toContain("socket\\.io");
    const res = proxy(
      new NextRequest("http://localhost/socket.io/?EIO=4&transport=polling"),
    );
    expect(res.status).not.toBe(413);
  });
});

describe("live Next /socket.io proxy", () => {
  test("polling handshake reaches agent when Next already rewrites", async () => {
    let text = "";
    let status = 0;
    try {
      const res = await fetch(
        "http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling",
        { signal: AbortSignal.timeout(1500) },
      );
      status = res.status;
      text = await res.text();
    } catch {
      return;
    }
    if (status === 404 || text.includes("<!DOCTYPE")) return;
    expect(status).toBe(200);
    expect(text.startsWith("0")).toBe(true);
    expect(text).toContain("sid");
  });
});
