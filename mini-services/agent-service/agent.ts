// PocketStudio agent — LLM access layer + tool-call parsing.
// Chat goes through the shared OpenAI/Anthropic gateway (src/lib/ai).
// Native provider function-calling is not used, so:
//   - replies stream over SSE (`stream: true`) and server.ts forwards
//     tokens on the existing `message:delta` socket event;
//   - tools are called through a JSON protocol: the system prompt
//     (prompts.ts) tells the model to answer with a single JSON object
//     {"tool":"<name>","args":{...}} when it wants a tool, and parseToolCall
//     below detects that shape. Partial JSON is never executed — wait until
//     a complete object is parseable. The tool-calling loop lives in server.ts.

import { sleepAbortable } from "../../src/lib/abort-flag";
import { chatCompletionStream } from "../../src/lib/ai/stream";
import {
  isUnconfiguredToolError,
  resolveToolRoute,
} from "../../src/lib/ai/resolve";
import type { AiToolId } from "../../src/lib/ai/tools";
import { recordChatUsage } from "../../src/lib/ai/usage-log";
import { db } from "./db-client";

/** LLM conversation turn (system prompt is passed separately). */
export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

/** A tool invocation parsed from an LLM reply. */
export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface GenerateOpts {
  userId: string;
  toolId?: AiToolId;
  jsonMode?: boolean;
  signal?: AbortSignal;
  /** Live token callback. JSON tool-only turns (jsonMode) skip SSE. */
  onDelta?: (delta: string) => void | Promise<void>;
}

const MAX_ATTEMPTS = 3; // initial call + 2 retries
const RETRY_BACKOFF_MS = 800;

/**
 * One raw LLM call: [systemPrompt, ...history] → reply text (may be either a
 * plain-text answer or a JSON tool call — parsing is the caller's job).
 * Native SSE when the provider supports it; jsonMode stays one-shot so a
 * partial `{"tool"` object cannot fire. Retries up to 2 times with 800ms
 * backoff unless tokens were already emitted. Throws on final failure.
 */
export async function generateLLMResponse(
  systemPrompt: string,
  history: LlmMessage[],
  opts: GenerateOpts,
): Promise<string> {
  let lastError: unknown = null;
  const toolId = opts.toolId ?? "agent";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let emitted = false;
    try {
      const route = await resolveToolRoute(db, opts.userId, toolId);
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];
      const result = await chatCompletionStream(route, messages, {
        jsonMode: opts.jsonMode,
        allowStream: !opts.jsonMode,
        signal: opts.signal,
        onDelta: opts.onDelta
          ? async (delta) => {
              emitted = true;
              await opts.onDelta!(delta);
            }
          : undefined,
      });
      if (!result.text) throw new Error("LLM returned empty content");
      void recordChatUsage(db, {
        userId: opts.userId,
        toolId,
        route,
        usage: result.usage,
      }).catch((err) => {
        console.warn(
          "[agent] usage log failed:",
          err instanceof Error ? err.message : String(err),
        );
      });
      return result.text;
    } catch (err) {
      if (isUnconfiguredToolError(err)) throw err;
      lastError = err;
      console.warn(
        `[agent] LLM attempt ${attempt}/${MAX_ATTEMPTS} failed:`,
        err instanceof Error ? err.message : String(err),
      );
      const status = (err as { status?: number })?.status;
      if (opts.signal?.aborted || status === 499) break;
      if (emitted) break;
      if (typeof status === "number" && status < 500) break;
      if (attempt < MAX_ATTEMPTS) await sleepAbortable(RETRY_BACKOFF_MS, opts.signal);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** True when the reply is still (or already) a JSON/fence tool candidate. */
export function looksLikeToolStart(text: string): boolean {
  const t = text.trimStart();
  if (!t) return false;
  if (t.startsWith("{")) return true;
  if (t.startsWith("```")) return true;
  if (/^\[TOOL_CALL\b/i.test(t)) return true;
  return false;
}

function extractFencedBlock(text: string): string | null {
  const m = text.match(/```(?:json|javascript|js)?\s*\r?\n?([\s\S]*?)```/i);
  return m ? m[1]!.trim() : null;
}

/** Strip a leading ```lang fence and trailing ``` if present. */
function stripFences(text: string): string {
  const m = text.match(/^```[a-zA-Z0-9_-]*\s*([\s\S]*?)\s*```\s*$/);
  return m ? m[1] : text;
}

/**
 * Split a reply into consecutive top-level {...} object candidates using a
 * string-aware brace-depth walk. Chained replies like
 *   {"tool":"write_file",…}\n{"tool":"checkpoint",…}
 * (observed in the wild: the model packs several calls into one answer)
 * are split into individual objects; prose between objects is ignored.
 */
function splitTopLevelObjects(text: string): string[] {
  const objects: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && start !== -1) {
          objects.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  return objects;
}

function parseJsonLenient(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    /* trailing commas are a frequent model slip */
  }
  try {
    return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1"));
  } catch {
    return undefined;
  }
}

function coerceArgs(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    const nested = parseJsonLenient(value);
    if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
      return nested as Record<string, unknown>;
    }
    return null;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

/** Parse one JSON string as a tool-call object, null when not shaped right. */
function tryParseToolObject(raw: string): ToolCall | null {
  const parsed = parseJsonLenient(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  const nestedFn =
    typeof obj.function === "object" && obj.function !== null && !Array.isArray(obj.function)
      ? (obj.function as Record<string, unknown>)
      : null;
  const toolRaw =
    (typeof obj.tool === "string" && obj.tool) ||
    (typeof obj.name === "string" && obj.name) ||
    (typeof nestedFn?.name === "string" && nestedFn.name) ||
    "";
  const tool = toolRaw.trim();
  if (!tool) return null;

  const argsCandidate =
    obj.args ?? obj.arguments ?? nestedFn?.arguments ?? nestedFn?.args;
  const wrapped = coerceArgs(argsCandidate);
  if (wrapped) return { tool, args: wrapped };

  // Flat form observed in the wild: {"tool":"write_file","path":…,…} —
  // the model forgot the args wrapper; treat the other keys as args.
  if (argsCandidate === undefined) {
    const rest = { ...obj };
    delete rest.tool;
    delete rest.name;
    delete rest.function;
    return { tool, args: rest };
  }
  return null;
}

/**
 * Detect a tool call in an LLM reply.
 *   1. trim; strip markdown fences when the reply starts with ```
 *   2. normalize a legacy "[TOOL_CALL name] {json}" bracket form
 *   3. when the reply starts with "{": split consecutive top-level objects
 *      (string-aware) and return the FIRST valid tool object — chained
 *      follow-up calls resurface naturally on the next loop iteration
 *      (the model re-emits them after each [TOOL_RESULT])
 *   4. fallback: plain JSON.parse of the whole reply / outermost {...} slice
 * Anything else is a plain-text answer → null.
 */
export function parseToolCall(text: string): ToolCall | null {
  if (typeof text !== "string") return null;
  let trimmed = text.trim();
  if (!trimmed) return null;

  const fenced = extractFencedBlock(trimmed);
  if (fenced) {
    const fromFence = tryParseToolObject(fenced);
    if (fromFence) return fromFence;
    for (const obj of splitTopLevelObjects(fenced)) {
      const call = tryParseToolObject(obj);
      if (call) return call;
    }
  }

  trimmed = stripFences(trimmed);
  if (!trimmed) return null;

  // Fallback: the model occasionally mimics the legacy bracket format
  // "[TOOL_CALL name] {json}" — normalize it to pure JSON first.
  const bracket = trimmed.match(/^\s*\[TOOL_CALL\s+([a-zA-Z_]+)\s*\]\s*([\s\S]+)$/i);
  if (bracket) {
    try {
      const args = JSON.parse(bracket[2].trim());
      if (typeof args === "object" && args !== null && !Array.isArray(args)) {
        return { tool: bracket[1], args: args as Record<string, unknown> };
      }
    } catch {
      // fall through to the regular candidates
    }
  }

  // Reply starts with an object → walk brace depth, try each top-level
  // object (handles chained calls AND single object + trailing prose).
  if (trimmed.startsWith("{")) {
    for (const obj of splitTopLevelObjects(trimmed)) {
      const call = tryParseToolObject(obj);
      if (call) return call;
    }
  }

  const candidates: string[] = [trimmed];
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first > 0 || (first === 0 && last < trimmed.length - 1)) {
    if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));
  }

  for (const candidate of candidates) {
    const call = tryParseToolObject(candidate);
    if (call) return call;
  }

  return null;
}

/**
 * Extract a {"steps":[...]} plan from an orchestrator (planner) reply.
 * Lenient: accepts fenced JSON, objects mixed with prose, and chained
 * objects; returns trimmed step strings (3–200 chars, max 8) or null when
 * no valid steps array is present (caller should skip orchestration).
 */
export function parsePlannerSteps(raw: string): string[] | null {
  if (typeof raw !== "string") return null;
  const text = stripFences(raw.trim());
  const candidates: string[] = [];
  if (text.includes("{")) {
    candidates.push(...splitTopLevelObjects(text));
  }
  candidates.push(text);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));

  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    const steps = (parsed as Record<string, unknown>).steps;
    if (!Array.isArray(steps)) continue;
    const cleaned = steps
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length >= 3 && s.length <= 200)
      .slice(0, 8);
    if (cleaned.length >= 2) return cleaned;
  }
  return null;
}
