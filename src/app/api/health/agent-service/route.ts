// Health / self-healing endpoint for the agent-service mini-service (:3003).
//
// The sandbox reaps detached background processes started from tool/bash
// sessions, while the system-managed Next.js dev server survives. So the
// reliable way to keep the socket.io service alive is to (re)spawn its
// supervisor FROM the dev-server process itself: the detached child then
// lives under the same protection as its immortal parent.
//
//   GET  → { up: boolean }                    (cheap TCP probe)
//   POST → probe; if down: spawn the supervisor, re-probe → { up, started }
//
// JSON never includes DATABASE_URL, AUTH_SECRET, paths, or stack traces.
// The frontend calls POST from use-socket on connect failure — the app
// heals itself on the next socket.io auto-reconnect attempt.

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

import { getUserFromRequest } from "@/lib/auth";
import { resolveAgentSupervisorPath } from "@/lib/agent-supervisor";
import {
  AGENT_UNAVAILABLE,
  AUTH_REQUIRED,
  agentProbeJson,
  agentStartErrorJson,
  agentStartJson,
  genericErrorJson,
} from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SERVICE_PORT = 3003;
const NO_STORE = { "cache-control": "no-store" };

/** TCP probe of the agent-service port (resolves in ~50ms). */
function probeService(timeoutMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result: boolean) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(SERVICE_PORT, "127.0.0.1");
  });
}

/** Detached supervisor spawn (child of THIS dev-server process). */
function spawnSupervisor(supervisorPath: string): void {
  const child = spawn("sh", [supervisorPath], {
    cwd: path.dirname(supervisorPath),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.on("error", () => {
    console.error("[health] agent-service supervisor spawn failed");
  });
  child.unref();
  console.log("[health] agent-service supervisor spawned");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET() {
  try {
    return NextResponse.json(agentProbeJson(await probeService()), {
      headers: NO_STORE,
    });
  } catch {
    console.error("[health] agent-service probe failed");
    return NextResponse.json(agentProbeJson(false), { headers: NO_STORE });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getUserFromRequest(req);
    if (!session) {
      return NextResponse.json(genericErrorJson(AUTH_REQUIRED), {
        status: 401,
        headers: NO_STORE,
      });
    }

    if (await probeService()) {
      return NextResponse.json(agentStartJson(true, false), {
        headers: NO_STORE,
      });
    }

    const supervisorPath = resolveAgentSupervisorPath();
    if (!supervisorPath) {
      console.error("[health] agent-service start.sh not found");
      return NextResponse.json(agentStartErrorJson(false), {
        status: 503,
        headers: NO_STORE,
      });
    }

    spawnSupervisor(supervisorPath);

    // bun --hot cold start can exceed 2s; wait long enough to report honestly.
    for (let i = 0; i < 16; i++) {
      await sleep(500);
      if (await probeService()) {
        return NextResponse.json(agentStartJson(true, true), {
          headers: NO_STORE,
        });
      }
    }
    return NextResponse.json(agentStartJson(false, true), {
      status: 503,
      headers: NO_STORE,
    });
  } catch {
    console.error("[health] agent-service start failed");
    return NextResponse.json(
      agentStartErrorJson(false, AGENT_UNAVAILABLE),
      { status: 503, headers: NO_STORE },
    );
  }
}
