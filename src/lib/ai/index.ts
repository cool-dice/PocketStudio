/**
 * Единый AI-интерфейс платформы (Фаза A) — единственная точка обращения
 * к z-ai-web-dev-sdk в Next-приложении. Только server-side: модуль
 * импортируется исключительно API routes.
 *
 * Возможности:
 * - chatJson: LLM-запрос со строгим JSON-выводом (анализ документов,
 *   генерация описаний сущностей);
 * - generateImage: text-to-image → base64 PNG;
 * - tts: text-to-speech → WAV Buffer.
 */

import ZAI from "z-ai-web-dev-sdk";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { db } from "@/lib/db";

type ZaiClient = Awaited<ReturnType<typeof ZAI.create>>;
let zaiPromise: Promise<ZaiClient> | null = null;

async function getZai(): Promise<ZaiClient> {
  zaiPromise ??= ZAI.create();
  return zaiPromise;
}

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
  ext: "png" | "wav" | "mp3",
): string {
  ensureGenDir();
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(GEN_DIR, name), data);
  return `/gen/${name}`;
}

/* ─────────────────────────── LLM (JSON) ─────────────────────────── */

/** Вытащить первый JSON-объект/массив из ответа модели.
 *  Сбалансированное сканирование скобок (учитывая строки) надёжнее
 *  lastIndexOf: переживает текст и скобки после JSON. */
function extractJson(text: string): unknown {
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

/** LLM → JSON с одним автоповтором: LLM иногда выдаёт битый JSON,
 *  вторая попытка почти всегда валидна. */
export async function aiChatJson<T>(system: string, user: string): Promise<T> {
  const zai = await getZai();
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      thinking: { type: "disabled" },
    });
    const content = response.choices[0]?.message?.content ?? "";
    try {
      return extractJson(content) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Модель не вернула JSON");
}

/** LLM-текст (не JSON) — для генерации описаний. */
export async function aiChatText(system: string, user: string): Promise<string> {
  const zai = await getZai();
  const response = await zai.chat.completions.create({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    thinking: { type: "disabled" },
  });
  return (response.choices[0]?.message?.content ?? "").trim();
}

/* ─────────────────────────── Image generation ─────────────────────────── */

/**
 * Санитайзер размера картинки: апстрим-требования — стороны 512–2880,
 * кратные 32, и суммарно ≤ 2^22 пикселей. Пресеты вида «1440x720»
 * доводятся до ближайших валидных (720 → 736), пропорция сохраняется.
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
    // Округление кратности могло снова превысить бюджет — жмём стороны.
    while (w * h > MAX_PIXELS && w > 512) w = round32(w - 32);
    while (w * h > MAX_PIXELS && h > 512) h = round32(h - 32);
  }
  return `${w}x${h}`;
}

/** Сгенерировать изображение и сохранить в public/gen → {url}. */
export async function aiGenerateImage(
  prompt: string,
  size = "1024x1024",
): Promise<{ url: string }> {
  const zai = await getZai();
  const safeSize = sanitizeImageSize(size);
  const response = await zai.images.generations.create({
    prompt,
    size: safeSize as "1024x1024",
  });
  const base64 = response.data[0]?.base64;
  if (!base64) throw new Error("Пустой ответ генерации изображения");
  const buffer = Buffer.from(base64, "base64");
  const url = saveGeneratedFile(buffer, "png");
  return { url };
}

/* ─────────────────────────── TTS ─────────────────────────── */

export const TTS_VOICES = [
  "tongtong",
  "chuichui",
  "xiaochen",
  "jam",
  "kazi",
  "douji",
  "luodo",
] as const;
export type TtsVoice = (typeof TTS_VOICES)[number];

/** Озвучить текст → WAV Buffer. */
export async function aiTts(
  text: string,
  voice: TtsVoice = "tongtong",
  speed = 1.0,
): Promise<Buffer> {
  const zai = await getZai();
  const response = await zai.audio.tts.create({
    input: text,
    voice,
    speed,
    response_format: "wav",
    stream: false,
  });
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(new Uint8Array(arrayBuffer));
}

/* ─────────────────────────── Пайплайны ─────────────────────────── */

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

const ANALYST_SYSTEM = `Ты — редактор-аналитик текста (Аналитик студии). Тебе дают документ с главами/разделами.
Найди до 8 самых важных проблем трёх видов:
- contradiction — противоречие (факт А противоречит факту Б в другом месте);
- omission — недосказанность (обещано, но не раскрыто; сцена/требование без развития);
- inconsistency — расхождение (числа, возраст, имена, формулировки расходятся между местами).
Отвечай СТРОГО JSON-массивом (без markdown), каждый элемент:
{"type":"contradiction|omission|inconsistency","severity":"info|warning|critical","title":"краткое описание проблемы на русском","quote":"точная цитата из текста (если есть)","advice":"конкретный совет, что сделать","sourceRef":"глава/раздел, напр. «гл. 2 · гл. 7»"}
Если проблем нет — верни [].`;

/** Анализ документа: секции → LLM → черновики находок. */
export async function aiAnalyzeDocument(
  sections: { title: string; content: string }[],
): Promise<AnalystFindingDraft[]> {
  const doc = sections
    .map((s) => `### ${s.title}\n${s.content}`)
    .join("\n\n");
  const raw = await aiChatJson<unknown>(ANALYST_SYSTEM, doc);
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

/* ─────────────────────────── Хелперы ─────────────────────────── */

/** Принадлежит ли воркспейс пользователю. */
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
