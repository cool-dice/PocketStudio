import { proxyAgentSocketRequest } from "@/lib/agent-socket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Bare `/socket.io` lands here via `src/proxy.ts` rewrite. */
export function GET(req: Request) {
  return proxyAgentSocketRequest(req);
}

export function POST(req: Request) {
  return proxyAgentSocketRequest(req);
}
