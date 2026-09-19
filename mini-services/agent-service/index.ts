// agent-service bootstrap.
// Env fallbacks MUST run BEFORE importing anything that reads env
// (server.ts → auth.ts reads AUTH_SECRET at module level; db-client.ts →
// src/lib/db.ts → PrismaClient reads DATABASE_URL at construction time).

import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

process.env.DATABASE_URL ||= "postgresql://pocketstudio:pocketstudio@127.0.0.1:5432/pocketstudio";
process.env.AUTH_SECRET ||= "vf-local-dev-secret-9f2c";
process.env.VIBEFLOW_WORKSPACE_ROOT ||= path.join(REPO_ROOT, "workspace");
process.env.VIBEFLOW_TEMPLATE_ROOT ||= path.join(REPO_ROOT, "templates/nextjs-basic");

// ── Next.js dev-server watchdog (sandbox self-heal) ─────────────────────
// The system-managed dev server can still die (OOM / crash) and nothing
// restarts it. This service survives the reaper, so a supervisor spawned
// FROM here is reaper-proof too. Probe :3000 every minute; when down,
// spawn next-supervisor.sh (single instance via flock).
import net from "node:net";

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host: "127.0.0.1" });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(700);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

async function ensureNextDev(): Promise<void> {
  if (await probePort(3000)) return;
  try {
    const { spawn } = await import("node:child_process");
    console.log("[watchdog] :3000 down — spawning next-supervisor.sh");
    const child = spawn(
      "sh",
      [path.join(REPO_ROOT, "mini-services/agent-service/next-supervisor.sh")],
      {
        cwd: REPO_ROOT,
        detached: true,
        stdio: "ignore",
      },
    );
    child.unref();
  } catch (err) {
    console.error("[watchdog] spawn failed:", err);
  }
}

void ensureNextDev();
setInterval(() => {
  void ensureNextDev();
}, 60_000);

// A failed server start (port already held by a sibling instance during
// hot-reload flapping) must EXIT — otherwise the watchdog interval keeps
// the process alive as a zombie and the supervisor cannot clean up.
try {
  await import("./server");
} catch (err) {
  console.error("[bootstrap] server failed to start:", err);
  process.exit(1);
}
