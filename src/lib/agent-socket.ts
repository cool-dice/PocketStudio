/**
 * Agent socket.io path and Next↔Caddy routing.
 *
 * Caddy `:81` forwards by `?XTransformPort=3003` and does not care about the
 * Engine.IO path. `bun run dev` on `:3000` has no Caddy, so Next must rewrite
 * `/socket.io` to the mini-service. Path `/` cannot be rewritten — it is the
 * app shell — so the engine path is the standard `/socket.io`.
 */

export const AGENT_SERVICE_PORT = 3003;
export const AGENT_SOCKET_PATH = "/socket.io";
export const AGENT_CADDY_PORT_QUERY = "XTransformPort";
export const AGENT_SERVICE_ORIGIN = `http://127.0.0.1:${AGENT_SERVICE_PORT}`;

/** Same-origin URI; query keeps Caddy :81 working when that gateway is up. */
export function agentSocketClientUri(): string {
  return `/?${AGENT_CADDY_PORT_QUERY}=${AGENT_SERVICE_PORT}`;
}

export function agentSocketProxyDestination(): string {
  return `${AGENT_SERVICE_ORIGIN}${AGENT_SOCKET_PATH}`;
}

export function agentSocketProxyRewrites(): {
  source: string;
  destination: string;
}[] {
  const dest = agentSocketProxyDestination();
  return [
    { source: AGENT_SOCKET_PATH, destination: dest },
    { source: `${AGENT_SOCKET_PATH}/`, destination: `${dest}/` },
    {
      source: `${AGENT_SOCKET_PATH}/:path*`,
      destination: `${dest}/:path*`,
    },
  ];
}

/** socket.io-client options: no trailing slash so Next does not 308 the handshake. */
export function agentSocketIoClientOptions() {
  return {
    path: AGENT_SOCKET_PATH,
    addTrailingSlash: false as const,
    transports: ["polling", "websocket"] as const,
  };
}

/** True for `/socket.io` and `/socket.io/...` (query/hash ignored). */
export function isAgentSocketPath(pathname: string): boolean {
  const noHash = pathname.split("#")[0] ?? pathname;
  const raw = (noHash.split("?")[0] || "/").trim() || "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  const normalized =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  return (
    normalized === AGENT_SOCKET_PATH ||
    normalized.startsWith(`${AGENT_SOCKET_PATH}/`)
  );
}

/**
 * Next.js 16 `proxy` matcher. `/socket.io` is excluded so Engine.IO polling
 * POSTs and websocket upgrades are not turned into Next responses.
 * The matcher string MUST be a compile-time literal in `src/proxy.ts`.
 */
export const PROXY_MATCHER = [
  "/((?!_next/static|_next/image|favicon.ico|socket\\.io).*)",
] as const;
