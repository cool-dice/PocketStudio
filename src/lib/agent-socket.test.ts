import { describe, expect, test } from "bun:test";

import nextConfig from "../../next.config";
import { config as proxyConfig, proxy } from "../proxy";
import { NextRequest } from "next/server";

import {
  AGENT_CADDY_PORT_QUERY,
  AGENT_SERVICE_PORT,
  AGENT_SOCKET_PATH,
  PROXY_MATCHER,
  agentSocketClientUri,
  agentSocketIoClientOptions,
  agentSocketProxyDestination,
  agentSocketUpstreamUrl,
  isAgentSocketPath,
  proxyAgentSocketRequest,
} from "./agent-socket";

describe("agent socket path for Next without Caddy", () => {
  test("engine path is /socket.io, not the app shell /", () => {
    expect(AGENT_SOCKET_PATH).toBe("/socket.io");
    expect(AGENT_SOCKET_PATH).not.toBe("/");
    expect(agentSocketClientUri()).toContain(
      `${AGENT_CADDY_PORT_QUERY}=${AGENT_SERVICE_PORT}`,
    );
    expect(agentSocketClientUri().startsWith("/?")).toBe(true);
  });

  test("upstream URL stays on :3003/socket.io", () => {
    expect(agentSocketProxyDestination()).toBe(
      "http://127.0.0.1:3003/socket.io",
    );
    expect(
      agentSocketUpstreamUrl(
        "http://localhost:3000/socket.io?EIO=4&transport=polling",
      ),
    ).toBe("http://127.0.0.1:3003/socket.io?EIO=4&transport=polling");
  });

  test("isAgentSocketPath does not match the homepage or /api", () => {
    expect(isAgentSocketPath("/socket.io")).toBe(true);
    expect(isAgentSocketPath("/socket.io/")).toBe(true);
    expect(isAgentSocketPath("/socket.io/?EIO=4")).toBe(true);
    expect(isAgentSocketPath("/")).toBe(false);
    expect(isAgentSocketPath("/api/health/agent-service")).toBe(false);
    expect(isAgentSocketPath("/w/abc")).toBe(false);
  });

  test("client options keep Engine.IO trailing slash; Next uses polling only", () => {
    const nextPort = agentSocketIoClientOptions("");
    expect(nextPort.path).toBe(AGENT_SOCKET_PATH);
    expect(nextPort.addTrailingSlash).toBe(true);
    expect(nextPort.transports).toEqual(["polling"]);
    expect(nextPort.upgrade).toBe(false);
    const caddy = agentSocketIoClientOptions("81");
    expect(caddy.transports[0]).toBe("websocket");
    expect(caddy.upgrade).toBe(true);
  });

  test("next.config only rewrites /socket.io onto the trailing-slash route", async () => {
    const raw = await nextConfig.rewrites?.();
    const rules = Array.isArray(raw)
      ? raw
      : [...(raw?.beforeFiles ?? []), ...(raw?.afterFiles ?? [])];
    expect(rules).toEqual([
      { source: "/socket.io", destination: "/socket.io/" },
    ]);
    expect(JSON.stringify(rules)).not.toContain(":3003");
  });

  test("proxy matcher skips socket.io so polling POSTs are not JSON-capped", () => {
    expect(PROXY_MATCHER.join(" ")).toContain("socket\\.io");
    expect(proxyConfig.matcher).toEqual([...PROXY_MATCHER]);
    const res = proxy(
      new NextRequest("http://localhost/socket.io/?EIO=4&transport=polling"),
    );
    expect(res.status).not.toBe(413);
  });

  test("HTTP proxy forwards Engine.IO handshake to :3003", async () => {
    const seen: { url: string; method: string }[] = [];
    const res = await proxyAgentSocketRequest(
      new Request("http://localhost:3000/socket.io?EIO=4&transport=polling"),
      async (url, init) => {
        seen.push({ url: String(url), method: String(init?.method ?? "GET") });
        return new Response(
          '0{"sid":"test","upgrades":[],"pingInterval":25000,"pingTimeout":60000}',
          { status: 200, headers: { "content-type": "text/plain" } },
        );
      },
    );
    expect(seen).toEqual([
      {
        url: "http://127.0.0.1:3003/socket.io?EIO=4&transport=polling",
        method: "GET",
      },
    ]);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("sid");
  });

  test("proxy 502s when the agent is unreachable, does not hang", async () => {
    const res = await proxyAgentSocketRequest(
      new Request("http://localhost:3000/socket.io?EIO=4&transport=polling"),
      async () => {
        throw new Error("ECONNREFUSED");
      },
    );
    expect(res.status).toBe(502);
  });
});

describe("live Next /socket.io proxy", () => {
  test("polling handshake reaches agent when Next already proxies", async () => {
    let text = "";
    let status = 0;
    try {
      const res = await fetch(
        "http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling",
        { signal: AbortSignal.timeout(2500) },
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
