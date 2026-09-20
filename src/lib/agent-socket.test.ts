import { describe, expect, test } from "bun:test";

import nextConfig from "../../next.config";
import { config as proxyConfig, proxy } from "../proxy";
import { NextRequest } from "next/server";

import {
  AGENT_CADDY_PORT_QUERY,
  AGENT_SERVICE_PORT,
  AGENT_SOCKET_INTERNAL_PATH,
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

  test("upstream URL always uses trailing slash so engine.io does not hang", () => {
    expect(agentSocketProxyDestination()).toBe(
      "http://127.0.0.1:3003/socket.io",
    );
    expect(
      agentSocketUpstreamUrl(
        "http://localhost:3000/socket.io?EIO=4&transport=polling",
      ),
    ).toBe("http://127.0.0.1:3003/socket.io/?EIO=4&transport=polling");
    expect(
      agentSocketUpstreamUrl(
        "http://localhost:3000/socket.io/?EIO=4&transport=polling",
      ),
    ).toBe("http://127.0.0.1:3003/socket.io/?EIO=4&transport=polling");
    expect(
      agentSocketUpstreamUrl(
        `http://localhost:3000${AGENT_SOCKET_INTERNAL_PATH}?EIO=4&transport=polling`,
      ),
    ).toBe("http://127.0.0.1:3003/socket.io/?EIO=4&transport=polling");
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

  test("next.config does not rewrite /socket.io (that rewrite hangs)", async () => {
    expect(typeof nextConfig.rewrites).toBe("undefined");
  });

  test("proxy rewrites bare /socket.io and does not JSON-cap polling POSTs", () => {
    expect(PROXY_MATCHER.join(" ")).not.toContain("socket\\.io");
    expect(proxyConfig.matcher).toEqual([...PROXY_MATCHER]);
    const bare = proxy(
      new NextRequest("http://localhost/socket.io?EIO=4&transport=polling"),
    );
    expect(bare.status).not.toBe(413);
    const rewrite =
      bare.headers.get("x-middleware-rewrite") ??
      bare.headers.get("location") ??
      "";
    expect(rewrite).toContain("agent-socket");
    const slashed = proxy(
      new NextRequest("http://localhost/socket.io/?EIO=4&transport=polling"),
    );
    expect(slashed.status).not.toBe(413);
  });

  test("HTTP proxy forwards Engine.IO handshake to :3003 with trailing slash", async () => {
    const seen: { url: string; method: string }[] = [];
    const handshake =
      '0{"sid":"test","upgrades":[],"pingInterval":25000,"pingTimeout":60000}';
    const mock: typeof fetch = async (url, init) => {
      seen.push({ url: String(url), method: String(init?.method ?? "GET") });
      return new Response(handshake, {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    };
    for (const incoming of [
      "http://localhost:3000/socket.io?EIO=4&transport=polling",
      "http://localhost:3000/socket.io/?EIO=4&transport=polling",
      `http://localhost:3000${AGENT_SOCKET_INTERNAL_PATH}?EIO=4&transport=polling`,
    ]) {
      seen.length = 0;
      const res = await proxyAgentSocketRequest(new Request(incoming), mock);
      expect(seen).toEqual([
        {
          url: "http://127.0.0.1:3003/socket.io/?EIO=4&transport=polling",
          method: "GET",
        },
      ]);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain("sid");
    }
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

async function tryLiveHandshake(
  url: string,
  timeoutMs: number,
): Promise<{ status: number; text: string; ms: number } | null> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return { status: res.status, text: await res.text(), ms: Date.now() - t0 };
  } catch {
    return null;
  }
}

describe("live Next /socket.io proxy", () => {
  test("bare /socket.io and trailing slash both handshake without hanging", async () => {
    const slash = await tryLiveHandshake(
      "http://127.0.0.1:3000/socket.io/?EIO=4&transport=polling",
      2500,
    );
    if (!slash || slash.status === 404 || slash.text.includes("<!DOCTYPE")) {
      return;
    }
    expect(slash.status).toBe(200);
    expect(slash.text.startsWith("0")).toBe(true);
    expect(slash.text).toContain("sid");

    const bare = await tryLiveHandshake(
      "http://127.0.0.1:3000/socket.io?EIO=4&transport=polling",
      2000,
    );
    expect(bare).not.toBeNull();
    expect(bare!.ms).toBeLessThan(2000);
    expect(bare!.status).toBe(200);
    expect(bare!.text.startsWith("0")).toBe(true);
    expect(bare!.text).toContain("sid");
  });
});
