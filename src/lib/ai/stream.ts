/**
 * Native token streaming for OpenAI `/v1/chat/completions` and Anthropic
 * `/v1/messages`. Falls back to one-shot chatCompletion if the provider
 * errors on `stream: true` (logged once per provider id).
 */

import { isAbortFlag } from "../abort-flag";
import {
  authHeaders,
  buildChatBody,
  chatCompletion,
  chatUrl,
  extractChatText,
  extractChatUsage,
  withUsage,
  type ChatMessage,
  type ChatResult,
  type ResolvedRoute,
} from "./connector";
import { GatewayError } from "./errors";
import { DEFAULT_TIMEOUT_MS, fetchForStream, throwIfNotOk } from "./http";
import { parseSseStream } from "./sse";

const streamFallbackLogged = new Set<string>();

/** Test hook — do not use in product code. */
export function resetStreamFallbackLog(): void {
  streamFallbackLogged.clear();
}

function logFallbackOnce(providerId: string, reason: string): void {
  if (streamFallbackLogged.has(providerId)) return;
  streamFallbackLogged.add(providerId);
  console.warn(
    `[ai] native stream failed for provider ${providerId}; falling back to one-shot (${reason})`,
  );
}

export function extractStreamDelta(event: unknown): string {
  const e = event as {
    choices?: Array<{ delta?: { content?: unknown } }>;
    type?: string;
    delta?: { type?: string; text?: string };
  };
  const content = e?.choices?.[0]?.delta?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : typeof part === "string"
            ? part
            : "",
      )
      .join("");
  }
  if (e?.type === "content_block_delta" && e.delta) {
    if (e.delta.type === "text_delta" || typeof e.delta.text === "string") {
      return e.delta.text ?? "";
    }
  }
  return "";
}

export function extractStreamUsage(event: unknown): {
  tokensIn: number | null;
  tokensOut: number | null;
} {
  const e = event as {
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
    };
    type?: string;
    message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  };
  const u = e?.usage;
  const msgU = e?.message?.usage;
  const tokensIn =
    typeof u?.prompt_tokens === "number"
      ? u.prompt_tokens
      : typeof u?.input_tokens === "number"
        ? u.input_tokens
        : typeof msgU?.input_tokens === "number"
          ? msgU.input_tokens
          : null;
  const tokensOut =
    typeof u?.completion_tokens === "number"
      ? u.completion_tokens
      : typeof u?.output_tokens === "number"
        ? u.output_tokens
        : typeof msgU?.output_tokens === "number"
          ? msgU.output_tokens
          : null;
  return { tokensIn, tokensOut };
}

export interface ChatStreamOpts {
  jsonMode?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onDelta?: (delta: string) => void | Promise<void>;
  /** jsonMode / tool-only turns skip SSE and use one-shot. Default: stream. */
  allowStream?: boolean;
}

async function readSseChat(
  route: ResolvedRoute,
  res: Response,
  opts: ChatStreamOpts,
): Promise<ChatResult> {
  if (!res.body) throw new GatewayError("Модель вернула пустой ответ", 502);
  let text = "";
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  for await (const event of parseSseStream(res.body, opts.signal)) {
    const piece = extractStreamDelta(event);
    if (piece) {
      text += piece;
      await opts.onDelta?.(piece);
    }
    const u = extractStreamUsage(event);
    if (u.tokensIn != null) tokensIn = u.tokensIn;
    if (u.tokensOut != null) tokensOut = u.tokensOut;
  }
  const trimmed = text.trim();
  if (!trimmed) throw new GatewayError("Модель вернула пустой ответ", 502);
  return {
    text: trimmed,
    usage: withUsage(tokensIn, tokensOut, route.provider),
  };
}

async function readJsonChat(
  route: ResolvedRoute,
  res: Response,
  opts: ChatStreamOpts,
): Promise<ChatResult> {
  const payload: unknown = await res.json();
  const text = extractChatText(route, payload).trim();
  if (!text) throw new GatewayError("Модель вернула пустой ответ", 502);
  await opts.onDelta?.(text);
  const usage = extractChatUsage(route, payload);
  return { text, usage: withUsage(usage.tokensIn, usage.tokensOut, route.provider) };
}

function isAbortLike(err: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted || isAbortFlag(err));
}

export async function chatCompletionStream(
  route: ResolvedRoute,
  messages: ChatMessage[],
  opts: ChatStreamOpts = {},
): Promise<ChatResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = opts.maxTokens ?? 4096;
  const allowStream = opts.allowStream !== false && !opts.jsonMode;

  if (!allowStream) {
    const result = await chatCompletion(route, messages, {
      jsonMode: opts.jsonMode,
      maxTokens,
      timeoutMs,
      signal: opts.signal,
    });
    if (opts.onDelta && result.text) await opts.onDelta(result.text);
    return result;
  }

  const headers = {
    ...authHeaders(route),
    "content-type": "application/json",
    accept: "text/event-stream",
  };
  const url = chatUrl(route);
  const body = JSON.stringify(
    buildChatBody(route, messages, {
      jsonMode: opts.jsonMode,
      maxTokens,
      stream: true,
    }),
  );

  let gotDelta = false;
  const onDelta = opts.onDelta
    ? async (delta: string) => {
        gotDelta = true;
        await opts.onDelta!(delta);
      }
    : undefined;

  try {
    const { res, dispose } = await fetchForStream(
      url,
      { method: "POST", headers, body, signal: opts.signal },
      timeoutMs,
    );
    try {
      await throwIfNotOk(res);
      const ctype = (res.headers.get("content-type") ?? "").toLowerCase();
      if (ctype.includes("json") && !ctype.includes("event-stream")) {
        return await readJsonChat(route, res, { ...opts, onDelta });
      }
      return await readSseChat(route, res, { ...opts, onDelta });
    } finally {
      dispose();
    }
  } catch (err) {
    if (isAbortLike(err, opts.signal)) {
      throw err instanceof GatewayError
        ? err
        : new GatewayError("Генерация остановлена", 499);
    }
    if (gotDelta) throw err;
    const reason = err instanceof Error ? err.message : "stream error";
    logFallbackOnce(route.provider.id, reason);
    const result = await chatCompletion(route, messages, {
      jsonMode: opts.jsonMode,
      maxTokens,
      timeoutMs,
      signal: opts.signal,
    });
    if (onDelta && result.text) await onDelta(result.text);
    return result;
  }
}
