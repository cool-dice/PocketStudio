/**
 * Runtime probes for MCP adapters. Builtin fetch/filesystem never need a
 * binary; browser_read needs `agent-browser` on PATH.
 */

import { spawn } from "node:child_process";

export function whichCommand(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(typeof code === "number"));
  });
}

export async function probeMcpRuntime(): Promise<{ agentBrowser: boolean }> {
  return { agentBrowser: await whichCommand("agent-browser") };
}

export type McpRuntimeStatus = "ready" | "off" | "config_saved" | "cli_missing";

export function mcpRuntimeStatus(opts: {
  enabled: boolean;
  external: boolean;
  adapter: string | null;
  agentBrowser: boolean;
}): McpRuntimeStatus {
  if (!opts.enabled) return "off";
  if (opts.external) return "config_saved";
  if (opts.adapter === "browser" && !opts.agentBrowser) return "cli_missing";
  return "ready";
}
