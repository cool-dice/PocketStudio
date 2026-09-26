import { proxyAgentSocketRequest } from "@/lib/agent-socket";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(req: Request) {
  return proxyAgentSocketRequest(req);
}

export function POST(req: Request) {
  return proxyAgentSocketRequest(req);
}
