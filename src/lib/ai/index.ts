/**
 * Единый AI-интерфейс платформы — точка обращения Next API routes.
 * Шлюз: OpenAI-совместимые и Anthropic-совместимые провайдеры
 * (ключи в БД, сервер проксирует). Только server-side.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { db } from "@/lib/db";
import {
  chatCompletion,
  generateImage,
  synthesizeSpeech,
  transcribeAudio,
  type ChatMessage,
} from "./connector";
import { GatewayError, isGatewayError } from "./errors";
import { resolveToolRoute } from "./resolve";
import type { AiToolId } from "./tools";
import { recordChatUsage } from "./usage-log";
import { composeImagePrompt, DOCUMENT_ANALYST_SYSTEM } from "./prompts";

export { GatewayError, isGatewayError } from "./errors";
export { AI_TOOLS, AI_TOOL_IDS, UNCONFIGURED_TOOL_MESSAGE } from "./tools";
export type { AiToolId } from "./tools";
export { maskApiKey, last4OfKey } from "./crypto";
export { resolveToolRoute } from "./resolve";
export { testConnection, mapTtsVoice, createEmbeddings } from "./connector";

/** Папка для сгенерированных файлов (раздаётся Next как статика /gen/...). */
const GEN_DIR = path.join(process.cwd(), "public", "gen");

function ensureGenDir(): void {
  if (!fs.existsSync(GEN_DIR)) {
    fs.mkdirSync(GEN_DIR, { recursive: true });
  }
}

/** Сохранить бинарник в public/gen и вернуть публичный URL. */
export function saveGeneratedFile(
  data: Buffer,
  ext: "png" | "wav" | "mp3" | "webm" | "mp4",
): string {
  ensureGenDir();
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(GEN_DIR, name), data);
  return `/gen/${name}`;
}

/** Вытащить первый JSON-объект/массив из ответа модели. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) throw new Error("Модель не вернула JSON");
  const openChar = cleaned[start];
  const closeChar = openChar === "[" ? "]" : "}";

  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (ch === "\\") {
      esc = true;
      continue;
    }
    if (ch === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error("Некорректный JSON от модели");
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function chatForTool(
  userId: string,
  toolId: AiToolId,
  messages: ChatMessage[],
  jsonMode = false,
): Promise<string> {
  const route = await resolveToolRoute(db, userId, toolId);
  const result = await chatCompletion(route, messages, { jsonMode });
  void recordChatUsage(db, {
    userId,
    toolId,
    route,
    usage: result.usage,
  }).catch((err) => {
    console.warn(
      "[ai] usage log failed:",
      err instanceof Error ? err.message : err,
    );
  });
  return result.text;
}

/** LLM → JSON с одним автоповтором. */
export async function aiChatJson<T>(
  userId: string,
  toolId: AiToolId,
  system: string,
  user: string,
): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await chatForTool(
        userId,
        toolId,
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        true,
      );
      return extractJson(content) as T;
    } catch (err) {
      if (isGatewayError(err) && err.status === 400) throw err;
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Модель не вернула JSON");
}

/** LLM-текст (не JSON). */
export async function aiChatText(
  userId: string,
  toolId: AiToolId,
  system: string,
  user: string,
): Promise<string> {
  return chatForTool(userId, toolId, [
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
}

/**
 * Санитайзер размера картинки: стороны 512–2880, кратные 32,
 * суммарно ≤ 2^22 пикселей.
 */
function sanitizeImageSize(size: string): string {
  const m = /^(\d{3,4})x(\d{3,4})$/.exec(size.trim());
  const round32 = (v: number) =>
    Math.min(2880, Math.max(512, Math.round(v / 32) * 32));
  let w = m ? round32(Number(m[1])) : 1024;
  let h = m ? round32(Number(m[2])) : 1024;

  const MAX_PIXELS = 2 ** 22;
  if (w * h > MAX_PIXELS) {
    const scale = Math.sqrt(MAX_PIXELS / (w * h));
    w = round32(w * scale);
    h = round32(h * scale);
    while (w * h > MAX_PIXELS && w > 512) w = round32(w - 32);
    while (w * h > MAX_PIXELS && h > 512) h = round32(h - 32);
  }
  return `${w}x${h}`;
}

export async function aiGenerateImage(
  userId: string,
  prompt: string,
  size = "1024x1024",
): Promise<{ url: string }> {
  const route = await resolveToolRoute(db, userId, "image");
  const { buffer } = await generateImage(route, {
    prompt: composeImagePrompt(prompt),
    size: sanitizeImageSize(size),
  });
  const url = saveGeneratedFile(buffer, "png");
  return { url };
}

export const TTS_VOICES = [
  "alloy",
  "nova",
  "shimmer",
  "echo",
  "onyx",
  "fable",
  "sage",
  "tongtong",
  "chuichui",
  "xiaochen",
  "jam",
  "kazi",
  "douji",
  "luodo",
] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];

export async function aiTts(
  userId: string,
  text: string,
  voice: TtsVoice = "alloy",
  speed = 1.0,
): Promise<Buffer> {
  const route = await resolveToolRoute(db, userId, "tts");
  return synthesizeSpeech(route, { text, voice, speed });
}

export async function aiTranscribe(
  userId: string,
  buffer: Buffer,
  mime?: string,
): Promise<string> {
  const route = await resolveToolRoute(db, userId, "asr");
  return transcribeAudio(route, { buffer, mime });
}

type FindingType = "contradiction" | "omission" | "inconsistency";
type FindingSeverity = "info" | "warning" | "critical";

export interface AnalystFindingDraft {
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  quote: string | null;
  advice: string | null;
  sourceRef: string | null;
}

export async function aiAnalyzeDocument(
  userId: string,
  sections: { title: string; content: string }[],
): Promise<AnalystFindingDraft[]> {
  const doc = sections.map((s) => `### ${s.title}\n${s.content}`).join("\n\n");
  const raw = await aiChatJson<unknown>(
    userId,
    "document_check",
    DOCUMENT_ANALYST_SYSTEM,
    doc,
  );
  if (!Array.isArray(raw)) return [];
  const allowedTypes = ["contradiction", "omission", "inconsistency"];
  const allowedSev = ["info", "warning", "critical"];
  return raw
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({
      type: (allowedTypes.includes(String(f.type)) ? f.type : "inconsistency") as FindingType,
      severity: (allowedSev.includes(String(f.severity)) ? f.severity : "warning") as FindingSeverity,
      title: String(f.title ?? "").slice(0, 300),
      quote: f.quote ? String(f.quote).slice(0, 600) : null,
      advice: f.advice ? String(f.advice).slice(0, 600) : null,
      sourceRef: f.sourceRef ? String(f.sourceRef).slice(0, 200) : null,
    }))
    .filter((f) => f.title.length > 0);
}

export async function assertProjectOwner(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  return project?.userId === userId;
}

/** Map a thrown error to a JSON API response payload. */
export function aiErrorResponse(err: unknown, fallback: string): {
  error: string;
  status: number;
} {
  if (err instanceof GatewayError) {
    return { error: err.message, status: err.status };
  }
  return { error: fallback, status: 502 };
}
