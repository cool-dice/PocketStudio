// VibeFlow agent — Stage-0 stub: single LLM turn, no tools yet.
// LLM access via z-ai-web-dev-sdk (backend-only). The SDK has no native
// streaming, so the full reply is fetched and then chunked by the transport
// layer (server.ts) for a streaming feel.

import ZAI from "z-ai-web-dev-sdk";
import { AGENT_SYSTEM_PROMPT } from "./prompts";

/** LLM conversation turn (system prompt is prepended automatically). */
export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
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
 * Run one Stage-0 agent turn: [systemPrompt, ...history] → reply text.
 * Retries up to 2 times with 800ms backoff. Throws on final failure.
 */
export async function generateReply(history: LlmMessage[]): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const zai = await getZai();
      const completion = await zai.chat.completions.create({
        messages: [{ role: "system", content: AGENT_SYSTEM_PROMPT }, ...history],
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
