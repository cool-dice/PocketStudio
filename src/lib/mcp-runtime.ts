/**
 * Runtime probes for MCP adapters. Builtin fetch/filesystem never need a
 * binary; browser_read needs `agent-browser` on PATH. stdio servers need
 * their `command` on PATH (or an existing path). A missing binary is never
 * treated as connected.
 */

import { spawn } from "node:child_process";
import { accessSync, constants as fsConstants } from "node:fs";

export function whichCommand(cmd: string): Promise<boolean> {
  const trimmed = cmd.trim();
  if (!trimmed) return Promise.resolve(false);
  if (trimmed.includes("/") || trimmed.startsWith(".")) {
    try {
      accessSync(trimmed, fsConstants.F_OK);
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  }
  return new Promise((resolve) => {
    const child = spawn("which", [trimmed], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 1500);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
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
  commandExists?: boolean | null;
}): McpRuntimeStatus {
  if (!opts.enabled) return "off";
  if (opts.adapter === "browser" && !opts.agentBrowser) return "cli_missing";
  if (opts.commandExists === false) return "cli_missing";
  if (opts.external) return "config_saved";
  return "ready";
}

export function stdioCommandFromConfig(
  config: Record<string, unknown>,
): string | null {
  const command = config.command;
  return typeof command === "string" && command.trim() ? command.trim() : null;
}

/** Builtin adapters whose tools the agent may call this turn. */
export function enabledMcpAdapters(
  rows: { adapter: string | null; enabled: boolean; external: boolean }[],
): Set<string> {
  const adapters = new Set<string>();
  for (const row of rows) {
    if (row.enabled && !row.external && row.adapter) adapters.add(row.adapter);
  }
  return adapters;
}

export function filesystemOffFromRows(
  rows: { adapter: string | null; enabled: boolean }[],
): boolean {
  const filesystemRow = rows.find((r) => r.adapter === "filesystem");
  return Boolean(filesystemRow) && !filesystemRow.enabled;
}

export async function resolveCommandPresence(
  commands: Iterable<string>,
): Promise<Map<string, boolean>> {
  const unique = [...new Set([...commands].filter(Boolean))];
  const pairs = await Promise.all(
    unique.map(async (cmd) => [cmd, await whichCommand(cmd)] as const),
  );
  return new Map(pairs);
}

export function attachMcpRuntimeStatus<
  T extends {
    enabled: boolean;
    external: boolean;
    adapter: string | null;
    transport?: string;
    config?: Record<string, unknown>;
  },
>(
  dto: T,
  opts: { agentBrowser: boolean; commandPresence?: Map<string, boolean> },
): T & { runtimeStatus: McpRuntimeStatus } {
  const command =
    dto.transport === "stdio" && dto.config
      ? stdioCommandFromConfig(dto.config)
      : null;
  const commandExists = command
    ? (opts.commandPresence?.get(command) ?? false)
    : null;
  return {
    ...dto,
    runtimeStatus: mcpRuntimeStatus({
      enabled: dto.enabled,
      external: dto.external,
      adapter: dto.adapter,
      agentBrowser: opts.agentBrowser,
      commandExists,
    }),
  };
}
