/**
 * OpenAI-compatible + Anthropic-compatible HTTP connector.
 * Shared by Next API routes and bun agent-service. No "@/..." aliases.
 *
 * Chat is normalized to system/user/assistant messages. Image / TTS / ASR
 * only work on openai_compatible providers — Anthropic fails with a clear
 * Russian error rather than crashing.
 */

import {
  ANTHROPIC_NO_ASR_MESSAGE,
  ANTHROPIC_NO_EMBEDDINGS_MESSAGE,
  ANTHROPIC_NO_IMAGE_MESSAGE,
  ANTHROPIC_NO_TTS_MESSAGE,
  type ProviderKind,
} from "./tools";
import { GatewayError } from "./errors";
import {
  DEFAULT_TIMEOUT_MS,
  IMAGE_TIMEOUT_MS,
  SPEECH_TIMEOUT_MS,
  fetchWithTimeout,
  joinUrl,
  parseExtraHeaders,
  throwIfNotOk,
} from "./http";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ResolvedProvider {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl: string;
  apiKey: string;
  extraHeaders: string | null;
  isPlatform: boolean;
  markupPercent: number | null;
  markupMultiplier: number | null;
}

export interface ResolvedModel {
  id: string;
  modelId: string;
  displayName: string;
  capChat: boolean;
  capImage: boolean;
  capTts: boolean;
  capAsr: boolean;
  capEmbeddings: boolean;
}

export interface ResolvedRoute {
  toolId: string;
  provider: ResolvedProvider;
  model: ResolvedModel;
}

export interface ChatUsage {
  tokensIn: number | null;
  tokensOut: number | null;
  /** tokensOut * applied markup multiplier (for future billing). */
  billableTokensOut: number | null;
}

export interface ChatResult {
  text: string;
  usage: ChatUsage;
}

function appliedMarkup(provider: ResolvedProvider): number {
  if (!provider.isPlatform) return 1;
  if (typeof provider.markupMultiplier === "number" && provider.markupMultiplier > 0) {
    return provider.markupMultiplier;
  }
  if (typeof provider.markupPercent === "number") {
    return 1 + provider.markupPercent / 100;
  }
  return 1;
}

export function withUsage(
  tokensIn: number | null,
  tokensOut: number | null,
  provider: ResolvedProvider,
): ChatUsage {
  const billable =
    tokensOut == null ? null : Math.round(tokensOut * appliedMarkup(provider));
  return { tokensIn, tokensOut, billableTokensOut: billable };
}

export function authHeaders(route: ResolvedRoute): Record<string, string> {
  const extra = parseExtraHeaders(route.provider.extraHeaders);
  const headers: Record<string, string> = { ...extra };
  if (route.provider.kind === "anthropic_compatible") {
    headers["x-api-key"] = route.provider.apiKey;
    if (!headers["anthropic-version"]) {
      headers["anthropic-version"] = "2023-06-01";
    }
  } else {
    headers.authorization = `Bearer ${route.provider.apiKey}`;
  }
  return headers;
}

function requireOpenai(route: ResolvedRoute, message: string): void {
  if (route.provider.kind === "anthropic_compatible") {
    throw new GatewayError(message, 400);
  }
}

function splitSystem(messages: ChatMessage[]): {
  system: string | undefined;
  rest: ChatMessage[];
} {
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else rest.push(m);
  }
  const system = systemParts.length ? systemParts.join("\n\n") : undefined;
  return { system, rest };
}

export function extractOpenAiText(payload: unknown): string {
  const p = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    content?: unknown;
  };
  const fromChoices = p?.choices?.[0]?.message?.content;
  if (typeof fromChoices === "string" && fromChoices.trim()) return fromChoices;
  if (Array.isArray(fromChoices)) {
    const joined = fromChoices
      .map((part) =>
        typeof part === "object" && part && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : typeof part === "string"
            ? part
            : "",
      )
      .join("");
    if (joined.trim()) return joined;
  }
  if (typeof p?.content === "string" && p.content.trim()) return p.content;
  return "";
}

export function extractAnthropicText(payload: unknown): string {
  const p = payload as { content?: Array<{ type?: string; text?: string }> | string };
  if (typeof p?.content === "string" && p.content.trim()) return p.content;
  if (Array.isArray(p?.content)) {
    return p.content
      .filter((b) => b && (b.type === "text" || typeof b.text === "string"))
      .map((b) => b.text ?? "")
      .join("");
  }
  return "";
}

function openaiUsage(payload: unknown): { tokensIn: number | null; tokensOut: number | null } {
  const u = (payload as { usage?: { prompt_tokens?: number; completion_tokens?: number } })
    ?.usage;
  return {
    tokensIn: typeof u?.prompt_tokens === "number" ? u.prompt_tokens : null,
    tokensOut: typeof u?.completion_tokens === "number" ? u.completion_tokens : null,
  };
}

function anthropicUsage(payload: unknown): {
  tokensIn: number | null;
  tokensOut: number | null;
} {
  const u = (payload as { usage?: { input_tokens?: number; output_tokens?: number } })?.usage;
  return {
    tokensIn: typeof u?.input_tokens === "number" ? u.input_tokens : null,
    tokensOut: typeof u?.output_tokens === "number" ? u.output_tokens : null,
  };
}

export function chatUrl(route: ResolvedRoute): string {
  if (route.provider.kind === "anthropic_compatible") {
    return joinUrl(
      route.provider.baseUrl.endsWith("/v1")
        ? route.provider.baseUrl
        : joinUrl(route.provider.baseUrl, "v1"),
      "messages",
    );
  }
  return joinUrl(route.provider.baseUrl, "chat/completions");
}

export function buildChatBody(
  route: ResolvedRoute,
  messages: ChatMessage[],
  opts: { jsonMode?: boolean; maxTokens?: number; stream?: boolean } = {},
): Record<string, unknown> {
  const maxTokens = opts.maxTokens ?? 4096;
  if (route.provider.kind === "anthropic_compatible") {
    const { system, rest } = splitSystem(messages);
    const systemText = opts.jsonMode
      ? [system, "Отвечай СТРОГО валидным JSON без markdown-ограждений."]
          .filter(Boolean)
          .join("\n")
      : system;
    return {
      model: route.model.modelId,
      max_tokens: maxTokens,
      ...(systemText ? { system: systemText } : {}),
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
      ...(opts.stream ? { stream: true } : {}),
    };
  }
  const body: Record<string, unknown> = {
    model: route.model.modelId,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: maxTokens,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  if (opts.stream) {
    body.stream = true;
    // OpenAI omits usage on SSE unless asked; billing needs the final frame.
    body.stream_options = { include_usage: true };
  }
  return body;
}

export function extractChatText(route: ResolvedRoute, payload: unknown): string {
  return route.provider.kind === "anthropic_compatible"
    ? extractAnthropicText(payload)
    : extractOpenAiText(payload);
}

export function extractChatUsage(
  route: ResolvedRoute,
  payload: unknown,
): { tokensIn: number | null; tokensOut: number | null } {
  return route.provider.kind === "anthropic_compatible"
    ? anthropicUsage(payload)
    : openaiUsage(payload);
}

export async function chatCompletion(
  route: ResolvedRoute,
  messages: ChatMessage[],
  opts: {
    jsonMode?: boolean;
    maxTokens?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<ChatResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxTokens = opts.maxTokens ?? 4096;
  const headers = {
    ...authHeaders(route),
    "content-type": "application/json",
  };
  const url = chatUrl(route);
  const body = JSON.stringify(
    buildChatBody(route, messages, { jsonMode: opts.jsonMode, maxTokens }),
  );
  const res = await fetchWithTimeout(
    url,
    { method: "POST", headers, body, signal: opts.signal },
    timeoutMs,
  );
  await throwIfNotOk(res);
  const payload: unknown = await res.json();
  const text = extractChatText(route, payload).trim();
  if (!text) throw new GatewayError("Модель вернула пустой ответ", 502);
  const usage = extractChatUsage(route, payload);
  return { text, usage: withUsage(usage.tokensIn, usage.tokensOut, route.provider) };
}

function decodeImagePayload(payload: unknown): Buffer {
  const data = (payload as { data?: Array<{ b64_json?: string; url?: string }> })?.data;
  const first = Array.isArray(data) ? data[0] : undefined;
  if (typeof first?.b64_json === "string") {
    return Buffer.from(first.b64_json, "base64");
  }
  throw new GatewayError("Пустой ответ генерации изображения", 502);
}

function asImageBuffer(buffer: Buffer): { buffer: Buffer } {
  if (buffer.length === 0) {
    throw new GatewayError("Генерация вернула пустой файл", 502);
  }
  return { buffer };
}

export async function generateImage(
  route: ResolvedRoute,
  opts: { prompt: string; size?: string; signal?: AbortSignal },
): Promise<{ buffer: Buffer }> {
  requireOpenai(route, ANTHROPIC_NO_IMAGE_MESSAGE);
  const url = joinUrl(route.provider.baseUrl, "images/generations");
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        ...authHeaders(route),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: route.model.modelId,
        prompt: opts.prompt,
        size: opts.size ?? "1024x1024",
        n: 1,
        response_format: "b64_json",
      }),
      signal: opts.signal,
    },
    IMAGE_TIMEOUT_MS,
  );
  await throwIfNotOk(res);
  const payload: unknown = await res.json();
  const first = (payload as { data?: Array<{ b64_json?: string; url?: string }> })?.data?.[0];
  if (typeof first?.b64_json === "string") {
    return asImageBuffer(Buffer.from(first.b64_json, "base64"));
  }
  if (first?.url) {
    const img = await fetchWithTimeout(first.url, { signal: opts.signal }, IMAGE_TIMEOUT_MS);
    await throwIfNotOk(img);
    return asImageBuffer(Buffer.from(await img.arrayBuffer()));
  }
  return asImageBuffer(decodeImagePayload(payload));
}

export const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
] as const;

const LEGACY_VOICE_MAP: Record<string, (typeof OPENAI_TTS_VOICES)[number]> = {
  tongtong: "alloy",
  chuichui: "nova",
  xiaochen: "shimmer",
  jam: "echo",
  kazi: "onyx",
  douji: "fable",
  luodo: "sage",
};

export function mapTtsVoice(voice: string | undefined): string {
  if (!voice) return "alloy";
  const lower = voice.toLowerCase();
  if ((OPENAI_TTS_VOICES as readonly string[]).includes(lower)) return lower;
  return LEGACY_VOICE_MAP[lower] ?? "alloy";
}

export async function synthesizeSpeech(
  route: ResolvedRoute,
  opts: { text: string; voice?: string; speed?: number; signal?: AbortSignal },
): Promise<Buffer> {
  requireOpenai(route, ANTHROPIC_NO_TTS_MESSAGE);
  const url = joinUrl(route.provider.baseUrl, "audio/speech");
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        ...authHeaders(route),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: route.model.modelId,
        input: opts.text,
        voice: mapTtsVoice(opts.voice),
        speed: opts.speed ?? 1,
        response_format: "wav",
      }),
      signal: opts.signal,
    },
    SPEECH_TIMEOUT_MS,
  );
  await throwIfNotOk(res);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length === 0) {
    throw new GatewayError("Озвучка вернула пустой файл", 502);
  }
  return buffer;
}

export async function transcribeAudio(
  route: ResolvedRoute,
  opts: { buffer: Buffer; filename?: string; mime?: string },
): Promise<string> {
  requireOpenai(route, ANTHROPIC_NO_ASR_MESSAGE);
  const url = joinUrl(route.provider.baseUrl, "audio/transcriptions");
  const form = new FormData();
  const mime = opts.mime && opts.mime.startsWith("audio/") ? opts.mime : "audio/wav";
  const filename = opts.filename ?? "audio.wav";
  const bytes = new Uint8Array(opts.buffer);
  form.append("file", new Blob([bytes], { type: mime }), filename);
  form.append("model", route.model.modelId);
  const headers = authHeaders(route);
  const res = await fetchWithTimeout(
    url,
    { method: "POST", headers, body: form },
    SPEECH_TIMEOUT_MS,
  );
  await throwIfNotOk(res);
  const payload: unknown = await res.json();
  const text =
    typeof (payload as { text?: unknown })?.text === "string"
      ? (payload as { text: string }).text.trim()
      : "";
  return text;
}

/**
 * Cheap connectivity probe: GET /models (OpenAI) or a tiny Anthropic message.
 * Throws GatewayError on failure.
 */
export async function testConnection(route: ResolvedRoute): Promise<{ ok: true; detail: string }> {
  const headers = authHeaders(route);
  if (route.provider.kind === "anthropic_compatible") {
    const url = joinUrl(
      route.provider.baseUrl.endsWith("/v1")
        ? route.provider.baseUrl
        : joinUrl(route.provider.baseUrl, "v1"),
      "messages",
    );
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({
          model: route.model.modelId || "claude-3-haiku-20240307",
          max_tokens: 8,
          messages: [{ role: "user", content: "ping" }],
        }),
      },
      20_000,
    );
    await throwIfNotOk(res);
    return { ok: true, detail: "Anthropic-совместимый API ответил" };
  }

  const modelsUrl = joinUrl(route.provider.baseUrl, "models");
  const res = await fetchWithTimeout(modelsUrl, { method: "GET", headers }, 20_000);
  if (res.ok) {
    return { ok: true, detail: "Список моделей получен" };
  }
  // Some local servers (llama.cpp) don't implement /models — try a tiny chat.
  const chatUrl = joinUrl(route.provider.baseUrl, "chat/completions");
  const chat = await fetchWithTimeout(
    chatUrl,
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        model: route.model.modelId || "dummy",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 4,
      }),
    },
    20_000,
  );
  await throwIfNotOk(chat);
  return { ok: true, detail: "Провайдер ответил на тестовый запрос" };
}

export interface EmbeddingsResult {
  vectors: number[][];
  dim: number;
}

/**
 * OpenAI-compatible POST /embeddings. Anthropic has no embeddings API —
 * fail with a clear Russian error instead of a cryptic 404.
 */
export async function createEmbeddings(
  route: ResolvedRoute,
  inputs: string[],
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<EmbeddingsResult> {
  requireOpenai(route, ANTHROPIC_NO_EMBEDDINGS_MESSAGE);
  const texts = inputs.map((t) => t.slice(0, 24_000));
  if (texts.length === 0) return { vectors: [], dim: 0 };
  const url = joinUrl(route.provider.baseUrl, "embeddings");
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        ...authHeaders(route),
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: route.model.modelId,
        input: texts.length === 1 ? texts[0] : texts,
      }),
      signal: opts.signal,
    },
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  await throwIfNotOk(res);
  const payload: unknown = await res.json();
  const data = (payload as { data?: Array<{ embedding?: number[]; index?: number }> })
    ?.data;
  if (!Array.isArray(data) || data.length === 0) {
    throw new GatewayError("Эмбеддинги: пустой ответ провайдера", 502);
  }
  const ordered = [...data].sort(
    (a, b) => (a.index ?? 0) - (b.index ?? 0),
  );
  const vectors = ordered.map((row) => {
    if (!Array.isArray(row.embedding) || row.embedding.length === 0) {
      throw new GatewayError("Эмбеддинги: провайдер не вернул вектор", 502);
    }
    return row.embedding;
  });
  if (vectors.length !== texts.length) {
    throw new GatewayError("Эмбеддинги: число векторов не совпало со входом", 502);
  }
  return { vectors, dim: vectors[0]?.length ?? 0 };
}
