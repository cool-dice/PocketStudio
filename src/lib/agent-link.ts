/**
 * Agent socket status. Never claim «на связи» unless the socket is up.
 * A failed POST /api/health/agent-service is «агент недоступен», not a
 * fake reconnect loop.
 */

export type AgentLinkStatus = "connected" | "reconnecting" | "unavailable";

export const AGENT_LINK_CONNECTED = "на связи";
export const AGENT_LINK_RECONNECTING = "переподключение…";
export const AGENT_LINK_UNAVAILABLE = "агент недоступен";

export function agentLinkLabel(status: AgentLinkStatus): string {
  if (status === "connected") return AGENT_LINK_CONNECTED;
  if (status === "unavailable") return AGENT_LINK_UNAVAILABLE;
  return AGENT_LINK_RECONNECTING;
}

export function agentLinkStatus(opts: {
  socketConnected: boolean;
  /** null = probe still in flight / unknown */
  healthUp: boolean | null;
}): AgentLinkStatus {
  if (opts.socketConnected) return "connected";
  if (opts.healthUp === false) return "unavailable";
  return "reconnecting";
}

export function agentHealthUpFromJson(json: unknown): boolean | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const up = (json as { up?: unknown }).up;
  return typeof up === "boolean" ? up : null;
}

export async function requestAgentStart(
  fetchImpl: typeof fetch = fetch,
): Promise<{ up: boolean }> {
  try {
    const res = await fetchImpl("/api/health/agent-service", {
      method: "POST",
      credentials: "same-origin",
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { up: agentHealthUpFromJson(json) === true };
  } catch {
    return { up: false };
  }
}
