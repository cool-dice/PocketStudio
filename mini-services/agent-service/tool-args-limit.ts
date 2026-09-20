/**
 * Cap parsed tool-call JSON so a model dumping a megabyte into
 * `{"tool","args"}` never reaches apply_patch / create_note / the DB.
 * Mirrors JSON body limits: 256 KiB default, 1 MiB for file writes.
 */

import { formatJsonBodyLimit } from "../../src/lib/json-body-limit";

/** Default parsed tool JSON — notes, search, RAG, most tools. */
export const TOOL_ARGS_LIMIT = 256 * 1024;

/** write_file / apply_patch may carry a file body. */
export const TOOL_ARGS_LIMIT_LARGE = 1024 * 1024;

const LARGE_ARG_TOOLS = new Set(["write_file", "apply_patch"]);

export const TOOL_ARGS_TOO_LARGE = "Аргументы инструмента слишком большие";

const encoder = new TextEncoder();

export function utf8ToolArgsBytes(text: string): number {
  return encoder.encode(text).byteLength;
}

export function toolArgsLimitBytes(tool: string): number {
  return LARGE_ARG_TOOLS.has(tool) ? TOOL_ARGS_LIMIT_LARGE : TOOL_ARGS_LIMIT;
}

export function isLargeArgTool(tool: string): boolean {
  return LARGE_ARG_TOOLS.has(tool);
}

export function toolArgsTooLargeMessage(
  tool: string,
  limitBytes: number = toolArgsLimitBytes(tool),
): string {
  const name = tool && tool !== "unknown" ? `«${tool}» — ` : "";
  return `${TOOL_ARGS_TOO_LARGE} — ${name}максимум ${formatJsonBodyLimit(limitBytes)}`;
}

/** First `"tool"` / `"name"` in the JSON head (no full parse). */
export function peekToolName(raw: string): string | null {
  const head = raw.length > 512 ? raw.slice(0, 512) : raw;
  const m = head.match(/"(?:tool|name)"\s*:\s*"([a-zA-Z][a-zA-Z0-9_]{0,63})"/);
  return m?.[1] ?? null;
}

export type ToolPayloadGate =
  | { ok: true }
  | { ok: false; error: string; tool: string; limitBytes: number };

/**
 * Reject a raw `{"tool","args"}` candidate before JSON.parse.
 * `tool` from peek or a known name; unknown uses the 1 MiB hard cap.
 */
export function candidateOverLimit(
  raw: string,
  tool: string | null,
): ToolPayloadGate | null {
  const bytes = utf8ToolArgsBytes(raw);
  if (tool) {
    const limitBytes = toolArgsLimitBytes(tool);
    if (bytes > limitBytes) {
      return {
        ok: false,
        error: toolArgsTooLargeMessage(tool, limitBytes),
        tool,
        limitBytes,
      };
    }
    return null;
  }
  if (bytes > TOOL_ARGS_LIMIT_LARGE) {
    return {
      ok: false,
      error: toolArgsTooLargeMessage("unknown", TOOL_ARGS_LIMIT_LARGE),
      tool: "unknown",
      limitBytes: TOOL_ARGS_LIMIT_LARGE,
    };
  }
  return null;
}

export function measureToolArgsBytes(args: Record<string, unknown>): number {
  return utf8ToolArgsBytes(JSON.stringify(args));
}

/** Post-parse check on the args object (execute wrapper + parse). */
export function gateToolPayload(call: {
  tool: string;
  args: Record<string, unknown>;
}): ToolPayloadGate {
  const tool = typeof call.tool === "string" ? call.tool.trim() : "";
  const limitBytes = toolArgsLimitBytes(tool || "unknown");
  let bytes: number;
  try {
    bytes = measureToolArgsBytes(call.args ?? {});
  } catch {
    return {
      ok: false,
      error: toolArgsTooLargeMessage(tool || "unknown", limitBytes),
      tool: tool || "unknown",
      limitBytes,
    };
  }
  if (bytes > limitBytes) {
    return {
      ok: false,
      error: toolArgsTooLargeMessage(tool || "unknown", limitBytes),
      tool: tool || "unknown",
      limitBytes,
    };
  }
  return { ok: true };
}

export type PreparedToolExecution = {
  argsForStore: string;
  argsForEmit: Record<string, unknown>;
  error: string | null;
};

/**
 * Execute wrapper: oversized → Russian error, empty args on the wire/DB.
 * `alreadyRejected` is the parse-time error when JSON.parse was skipped.
 */
export function prepareToolExecution(
  call: { tool: string; args: Record<string, unknown> },
  alreadyRejected?: string,
): PreparedToolExecution {
  if (alreadyRejected) {
    return { argsForStore: "{}", argsForEmit: {}, error: alreadyRejected };
  }
  const gate = gateToolPayload(call);
  if (!gate.ok) {
    return { argsForStore: "{}", argsForEmit: {}, error: gate.error };
  }
  return {
    argsForStore: JSON.stringify(call.args),
    argsForEmit: call.args,
    error: null,
  };
}
