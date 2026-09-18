// PocketStudio agent — LLM access layer + tool-call parsing.
// LLM access via z-ai-web-dev-sdk (backend-only). The SDK has no native
// streaming and no native function calling, so:
//   - the full reply is fetched here and chunked by the transport layer
//     (server.ts) for a streaming feel;
//   - tools are called through a JSON protocol: the system prompt
//     (prompts.ts) tells the model to answer with a single JSON object
//     {"tool":"<name>","args":{...}} when it wants a tool, and parseToolCall
//     below detects that shape. The tool-calling loop lives in server.ts.

import ZAI from "z-ai-web-dev-sdk";

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

type ZaiInstance = Awaited<ReturnType<typeof ZAI.create>>;

// Module-level cached instance (one SDK client per process).
let zaiInstance: ZaiInstance | null = null;

export async function getZai(): Promise<ZaiInstance> {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract text from an OpenAI-shaped chat completion response. */
function extractContent(completion: unknown): string {
  const c = completion as {
    choices?: Array<{ message?: { content?: unknown } }>;
    content?: unknown;
  };
  const fromChoices = c?.choices?.[0]?.message?.content;
  if (typeof fromChoices === "string" && fromChoices.trim()) return fromChoices;
  if (typeof c?.content === "string" && c.content.trim()) return c.content;
  return "";
}

const MAX_ATTEMPTS = 3; // initial call + 2 retries
const RETRY_BACKOFF_MS = 800;

/**
 * One raw LLM call: [systemPrompt, ...history] → reply text (may be either a
 * plain-text answer or a JSON tool call — parsing is the caller's job).
 * Retries up to 2 times with 800ms backoff. Throws on final failure.
 */
export async function generateLLMResponse(
  systemPrompt: string,
  history: LlmMessage[],
): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const zai = await getZai();
      const completion = await zai.chat.completions.create({
        messages: [{ role: "system", content: systemPrompt }, ...history],
        thinking: { type: "disabled" },
      });
      const content = extractContent(completion);
      if (!content) throw new Error("LLM returned empty content");
      return content;
    } catch (err) {
      lastError = err;
      console.warn(
        `[agent] LLM attempt ${attempt}/${MAX_ATTEMPTS} failed:`,
        err instanceof Error ? err.message : String(err),
      );
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_BACKOFF_MS);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
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

/** Parse one JSON string as a tool-call object, null when not shaped right. */
function tryParseToolObject(raw: string): ToolCall | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.tool === "string" && obj.tool.trim()) {
    if (typeof obj.args === "object" && obj.args !== null && !Array.isArray(obj.args)) {
      return { tool: obj.tool.trim(), args: obj.args as Record<string, unknown> };
    }
    // Flat form observed in the wild: {"tool":"write_file","path":…,…} —
    // the model forgot the args wrapper; treat the other keys as args.
    if (obj.args === undefined) {
      const { tool, ...rest } = obj;
      return { tool: tool.trim(), args: rest as Record<string, unknown> };
    }
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
  let trimmed = stripFences(text.trim());
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

/**
 * Split a full reply into chunks of ~4–10 words for simulated streaming.
 * Concatenating the chunks reproduces the original text exactly
 * (whitespace preserved).
 */
export function chunkText(
  text: string,
  opts: { minWords?: number; maxWords?: number } = {},
): string[] {
  const minWords = opts.minWords ?? 4;
  const maxWords = opts.maxWords ?? 10;

  // Split keeping the whitespace separators so concatenation is lossless.
  const parts = text.split(/(\s+)/).filter((p) => p.length > 0);
  const chunks: string[] = [];

  let i = 0;
  while (i < parts.length) {
    const target =
      minWords + Math.floor(Math.random() * (maxWords - minWords + 1));
    let words = 0;
    let chunk = "";
    while (i < parts.length && words < target) {
      const part = parts[i];
      chunk += part;
      if (!/^\s+$/.test(part)) words++;
      i++;
    }
    // Attach trailing whitespace to the current chunk.
    while (i < parts.length && /^\s+$/.test(parts[i])) {
      chunk += parts[i];
      i++;
    }
    if (chunk.length > 0) chunks.push(chunk);
  }

  return chunks;
}
