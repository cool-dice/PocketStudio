/**
 * Agent socket.io path and Next↔Caddy routing.
 *
 * Caddy `:81` forwards by `?XTransformPort=3003` and does not care about the
 * Engine.IO path. `bun run dev` on `:3000` has no Caddy, so Next must proxy
 * `/socket.io` to the mini-service. Path `/` cannot be the engine path — it
 * is the app shell — so the engine path is the standard `/socket.io`.
 *
 * Do not use next.config `rewrites()` to :3003: Turbopack's external rewrite
 * hangs (open socket, no bytes). The App Router route calls this helper.
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

export function agentSocketUpstreamUrl(requestUrl: string): string {
  const incoming = new URL(requestUrl);
  return `${AGENT_SERVICE_ORIGIN}${incoming.pathname}${incoming.search}`;
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

export async function proxyAgentSocketRequest(
  req: Request,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const incoming = new URL(req.url);
  if (!isAgentSocketPath(incoming.pathname)) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const init: RequestInit = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let res: Response;
  try {
    res = await fetchImpl(agentSocketUpstreamUrl(req.url), init);
  } catch {
    return new Response(null, { status: 502 });
  }

  const out = new Headers();
  for (const name of [
    "content-type",
    "cache-control",
    "access-control-allow-origin",
  ]) {
    const value = res.headers.get(name);
    if (value) out.set(name, value);
  }
  if (!out.has("cache-control")) out.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, headers: out });
}

/**
 * On Caddy :81 use websocket; on Next :3000 stay on HTTP polling (the App
 * Router proxy cannot upgrade).
 */
export function agentSocketIoClientOptions(port = ""): {
  path: string;
  addTrailingSlash: true;
  transports: readonly ["polling"] | readonly ["websocket", "polling"];
  upgrade: boolean;
} {
  const viaCaddy = port === "81";
  if (viaCaddy) {
    return {
      path: AGENT_SOCKET_PATH,
      addTrailingSlash: true,
      transports: ["websocket", "polling"],
      upgrade: true,
    };
  }
  return {
    path: AGENT_SOCKET_PATH,
    addTrailingSlash: true,
    transports: ["polling"],
    upgrade: false,
  };
}

/**
 * Next.js 16 `proxy` matcher. `/socket.io` is excluded so Engine.IO polling
 * POSTs are not JSON-capped. The matcher string MUST be a compile-time
 * literal in `src/proxy.ts`.
 */
export const PROXY_MATCHER = [
  "/((?!_next/static|_next/image|favicon.ico|socket\\.io).*)",
] as const;
