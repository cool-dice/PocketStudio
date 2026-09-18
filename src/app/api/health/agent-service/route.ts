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
// The frontend calls POST from use-socket on connect failure — the app
// heals itself on the next socket.io auto-reconnect attempt.

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SERVICE_PORT = 3003;
const SUPERVISOR_PATH = path.join(
  process.cwd(),
  "mini-services",
  "agent-service",
  "start.sh",
);

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
function spawnSupervisor(): void {
  const child = spawn("sh", [SUPERVISOR_PATH], {
    cwd: path.dirname(SUPERVISOR_PATH),
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();
  console.log(`[health] agent-service supervisor spawned (pid ${child.pid})`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET() {
  return NextResponse.json({ up: await probeService() });
}

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  if (await probeService()) {
    return NextResponse.json({ up: true, started: false });
  }

  spawnSupervisor();

  // The service boots in ~1–2s; give it a few chances before reporting.
  for (let i = 0; i < 10; i++) {
    await sleep(400);
    if (await probeService()) {
      return NextResponse.json({ up: true, started: true });
    }
  }
  return NextResponse.json({ up: false, started: true }, { status: 503 });
}
