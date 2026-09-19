// PocketStudio workspace tools (Фаза A) — сущности, Аналитик, генерация.
//
// Четыре инструмента оркестратора, работающие с контентом воркспейсов:
//   create_entity   — сущность в картотеке (персонаж/локация/требование…);
//   check_document  — прогон документа Аналитиком → Findings в БД;
//   generate_image  — SDK-генерация картинки → public/gen → Artifact;
//   tts_narration   — SDK-озвучка текста → public/gen → Artifact.
//
// Паттерн повторяет tools.ts 1:1: ToolDef + ручная валидация аргументов
// (невалидные → {error: "..."} вместо throw), userId-scoped, БД напрямую
// через db-client. Медиа генерируется шлюзом src/lib/ai (OpenAI/Anthropic),
// файлы кладутся в public/gen и раздаются Next'ом как /gen/…
// (абсолютный путь: сервис запущен с cwd mini-services/agent-service).
//
// Авторизация инструментов = userId оркестратора (так же, как create_note
// и create_project создают записи от имени юзера напрямую в БД).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { db } from "./db-client";
import { generateLLMResponse } from "./agent";
import { generateImage, synthesizeSpeech } from "../../src/lib/ai/connector";
import { resolveToolRoute } from "../../src/lib/ai/resolve";
import type { ToolContext, ToolDef } from "./tools";

// ─────────────────────────── shared helpers ───────────────────────────

/** Абсолютный путь до public/gen основного Next-приложения. */
const GEN_DIR = "/home/z/my-project/public/gen";

/** Сохранить бинарник в public/gen и вернуть публичный URL. */
function saveGenFile(data: Buffer, ext: "png" | "wav"): string {
  fs.mkdirSync(GEN_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(GEN_DIR, name), data);
  return `/gen/${name}`;
}

interface WorkspaceRow {
  id: string;
  name: string;
  type: string;
}

/**
 * Найти воркспейс пользователя: по id (workspaceId/projectId) или по
 * названию (SQLite не умеет регистронезависимый LIKE для кириллицы —
 * фильтруем в JS, как findCategoryByName в tools.ts). Приоритет: точное
 * совпадение → «начинается с» → «содержит».
 */
async function resolveWorkspace(
  userId: string,
  args: Record<string, unknown>,
): Promise<WorkspaceRow | { error: string }> {
  const idArg = pickString(args, ["workspaceId", "projectId"]);
  if (idArg) {
    const byId = await db.project.findFirst({
      where: { id: idArg, userId },
      select: { id: true, name: true, type: true },
    });
    if (byId) return byId;
    return { error: "Воркспейс с таким id не найден" };
  }

  const name = pickString(args, ["workspaceName", "projectName"]);
  if (!name) {
    return {
      error:
        "Укажите воркспейс: передайте workspaceId или workspaceName (название)",
    };
  }

  const all = await db.project.findMany({
    where: { userId, origin: "workspace" },
    select: { id: true, name: true, type: true },
    orderBy: { updatedAt: "desc" },
  });
  const lower = name.toLowerCase();
  const found =
    all.find((p) => p.name.toLowerCase() === lower) ??
    all.find((p) => p.name.toLowerCase().startsWith(lower)) ??
    all.find((p) => p.name.toLowerCase().includes(lower));
  if (found) return found;
  return {
    error: `Воркспейс «${name}» не найден — проверьте название или передайте workspaceId`,
  };
}

/** Первая непустая строка из перечисленных ключей аргументов. */
function pickString(
  args: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Опциональная строка (null → null). */
function optString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

// ─────────────────────────── tool: create_entity ───────────────────────────

const ENTITY_KINDS = [
  "character", "location", "event", "item", "faction", "rule",
  "user", "role", "requirement", "module", "integration",
] as const;

/** Синонимы, которые любит присылать модель («персонаж» → character). */
const KIND_ALIASES: Record<string, string> = {
  "персонаж": "character",
  "герой": "character",
  "локация": "location",
  "место": "location",
  "событие": "event",
  "предмет": "item",
  "фракция": "faction",
  "правило": "rule",
  "пользователь": "user",
  "роль": "role",
  "требование": "requirement",
  "модуль": "module",
  "интеграция": "integration",
};

/** Палитра градиентов для портрета-заглушки (без синего/индиго). */
const PORTRAIT_GRADIENTS = [
  "linear-gradient(135deg,#34d399,#059669)",
  "linear-gradient(135deg,#fbbf24,#d97706)",
  "linear-gradient(135deg,#fb7185,#be123c)",
  "linear-gradient(135deg,#a1a1aa,#3f3f46)",
  "linear-gradient(135deg,#2dd4bf,#0d9488)",
  "linear-gradient(135deg,#a78bfa,#7c3aed)",
];

function makePortrait(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) | 0;
  const gradient = PORTRAIT_GRADIENTS[Math.abs(hash) % PORTRAIT_GRADIENTS.length]!;
  const words = name.trim().split(/\s+/);
  const initials =
    (words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "");
  return JSON.stringify({ gradient, initials: initials.toUpperCase() });
}

const createEntity: ToolDef = {
  name: "create_entity",
  description:
    "Создать сущность в картотеке воркспейса: для книг — персонаж/локация/событие/предмет/фракция/правило, для документации — пользователь/роль/требование/модуль/интеграция. Возвращает «Сущность создана: имя (вид)» и id. Воркспейс можно указать id или названием.",
  argsSchema: {
    workspaceId: "id воркспейса (или workspaceName)",
    workspaceName: "название воркспейса, если id нет",
    kind: "вид сущности: character|location|event|item|faction|rule|user|role|requirement|module|integration (обязательно)",
    name: "имя/название сущности (обязательно, 1–120 символов)",
    short: "короткая характеристика (необязательно, до 200 символов)",
    description: "подробное описание (необязательно, до 20000 символов)",
    setId: "идентификатор набора сущностей (необязательно, по умолчанию main)",
    setName: "название набора (необязательно)",
  },
  async execute(args: any, userId: string, _ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    // kind (required, allowlist + русские синонимы)
    if (typeof args.kind !== "string" || !args.kind.trim()) {
      return { error: "Аргумент kind обязателен: character, location, event, item, faction, rule, user, role, requirement, module или integration" };
    }
    const kindRaw = args.kind.trim().toLowerCase();
    const kind = (ENTITY_KINDS as readonly string[]).includes(kindRaw)
      ? kindRaw
      : KIND_ALIASES[kindRaw];
    if (!kind) {
      return { error: `Неизвестный вид сущности «${args.kind}» — допустимо: character, location, event, item, faction, rule, user, role, requirement, module, integration` };
    }

    // name (required, 1..120)
    const name = optString(args.name, 200);
    if (!name) return { error: "Аргумент name обязателен (имя сущности)" };
    if (name.length > 120) {
      return { error: "Имя сущности слишком длинное (максимум 120 символов)" };
    }

    const short = optString(args.short, 200);
    const description = optString(args.description, 20_000);
    const setId = optString(args.setId, 60);
    const setName = optString(args.setName, 120);

    const ws = await resolveWorkspace(userId, args);
    if ("error" in ws) return { error: ws.error };

    const entity = await db.entity.create({
      data: {
        projectId: ws.id,
        setId: setId ?? "main",
        setName: setName ?? "Сущности",
        domain: ws.type === "app" ? "product" : "narrative",
        kind,
        name,
        short,
        description: description ?? "",
        portrait: makePortrait(name),
      },
    });

    return {
      message: `Сущность создана: ${entity.name} (${entity.kind})`,
      entity: {
        id: entity.id,
        name: entity.name,
        kind: entity.kind,
        domain: entity.domain,
        setName: entity.setName,
        workspace: ws.name,
      },
    };
  },
};

// ─────────────────────────── tool: check_document ───────────────────────────

/** Промпт Аналитика — копия ANALYST_SYSTEM из src/lib/ai/index.ts (Фаза A). */
const ANALYST_SYSTEM = `Ты — редактор-аналитик текста (Аналитик студии). Тебе дают документ с главами/разделами.
Найди до 8 самых важных проблем трёх видов:
- contradiction — противоречие (факт А противоречит факту Б в другом месте);
- omission — недосказанность (обещано, но не раскрыто; сцена/требование без развития);
- inconsistency — расхождение (числа, возраст, имена, формулировки расходятся между местами).
Отвечай СТРОГО JSON-массивом (без markdown), каждый элемент:
{"type":"contradiction|omission|inconsistency","severity":"info|warning|critical","title":"краткое описание проблемы на русском","quote":"точная цитата из текста (если есть)","advice":"конкретный совет, что сделать","sourceRef":"глава/раздел, напр. «гл. 2 · гл. 7»"}
Если проблем нет — верни [].`;

/** Вытащить первый JSON-массив/объект из ответа модели (как src/lib/ai). */
function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start < 0) throw new Error("Модель не вернула JSON");
  const openChar = cleaned[start]!;
  const closeChar = openChar === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closeChar);
  if (end <= start) throw new Error("Некорректный JSON от модели");
  return JSON.parse(cleaned.slice(start, end + 1));
}

interface FindingDraft {
  type: string;
  severity: string;
  title: string;
  quote: string | null;
  advice: string | null;
  sourceRef: string | null;
}

function parseFindings(raw: string): FindingDraft[] {
  const parsed = extractJson(raw);
  if (!Array.isArray(parsed)) return [];
  const types = ["contradiction", "omission", "inconsistency"];
  const severities = ["info", "warning", "critical"];
  return parsed
    .filter((f): f is Record<string, unknown> => typeof f === "object" && f !== null)
    .map((f) => ({
      type: types.includes(String(f.type)) ? String(f.type) : "inconsistency",
      severity: severities.includes(String(f.severity)) ? String(f.severity) : "warning",
      title: String(f.title ?? "").slice(0, 300),
      quote: f.quote ? String(f.quote).slice(0, 600) : null,
      advice: f.advice ? String(f.advice).slice(0, 600) : null,
      sourceRef: f.sourceRef ? String(f.sourceRef).slice(0, 200) : null,
    }))
    .filter((f) => f.title.length > 0)
    .slice(0, 8);
}

const checkDocument: ToolDef = {
  name: "check_document",
  description:
    "Проверить документ Аналитиком студии: находит противоречия, недосказанности и расхождения, сохраняет находки в карточку документа. Документ можно задать documentId или парой «воркспейс + documentTitle» (воркспейс — id или названием).",
  argsSchema: {
    documentId: "идентификатор документа (если известен)",
    workspaceId: "id воркспейса (для поиска по названию документа)",
    workspaceName: "название воркспейса, если id нет",
    documentTitle: "название документа (с workspaceId/workspaceName)",
  },
  async execute(args: any, userId: string, _ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    // 1. Найти документ: documentId → прямой; иначе воркспейс + название;
    //    иначе название по всем воркспейсам пользователя.
    const documentId = pickString(args, ["documentId"]);
    let document: { id: string; projectId: string; title: string; kind: string } | null = null;

    if (documentId) {
      const row = await db.document.findFirst({
        where: { id: documentId },
        select: { id: true, projectId: true, title: true, kind: true },
      });
      if (!row) return { error: "Документ не найден" };
      const owner = await db.project.findFirst({
        where: { id: row.projectId, userId },
        select: { id: true },
      });
      if (!owner) return { error: "Документ не найден" };
      document = row;
    } else {
      const title = pickString(args, ["documentTitle", "title"]);
      if (!title) {
        return { error: "Укажите documentId или пару «воркспейс + documentTitle»" };
      }
      const lower = title.toLowerCase();
      const candidates: { id: string; projectId: string }[] = [];

      const ws = await resolveWorkspace(userId, args);
      if (!("error" in ws)) {
        const docs = await db.document.findMany({
          where: { projectId: ws.id },
          select: { id: true, projectId: true, title: true, kind: true },
        });
        candidates.push(
          ...docs.filter((d) => d.title.toLowerCase().includes(lower)),
        );
      } else if (ws.error.startsWith("Укажите воркспейс")) {
        // Названия документа без воркспейса — ищем по всем воркспейсам юзера.
        const docs = await db.document.findMany({
          where: { project: { userId, origin: "workspace" } },
          select: { id: true, projectId: true, title: true, kind: true },
        });
        candidates.push(
          ...docs.filter((d) => d.title.toLowerCase().includes(lower)),
        );
      } else {
        return { error: ws.error };
      }

      const exact = candidates.length > 0 ? candidates[0]! : null;
      if (!exact) {
        return { error: `Документ «${title}» не найден — проверьте название` };
      }
      const full = await db.document.findUnique({
        where: { id: exact.id },
        select: { id: true, projectId: true, title: true, kind: true },
      });
      document = full;
    }

    if (!document) return { error: "Документ не найден" };

    // 2. Секции (как REST /api/ai/analyze: только заполненные, по порядку).
    const sections = await db.documentSection.findMany({
      where: { documentId: document.id },
      orderBy: { order: "asc" },
    });
    const filled = sections.filter((s) => s.content.trim().length > 0);
    if (filled.length === 0) {
      return { error: "Документ пуст — сначала напишите текст" };
    }
    const docText = filled
      .map((s) => `### ${s.title}\n${s.content.slice(0, 6_000)}`)
      .join("\n\n")
      .slice(0, 60_000);

    // 3. LLM-анализ (свой SDK, промпт как у Аналитика Next-стороны).
    let drafts: FindingDraft[];
    try {
      const raw = await generateLLMResponse(ANALYST_SYSTEM, [
        { role: "user", content: docText },
      ], { userId, toolId: "document_check", jsonMode: true });
      drafts = parseFindings(raw);
    } catch (err) {
      return {
        error:
          "Аналитик не справился: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }

    // 4. Открытые находки заменяются, статусы fixed/dismissed живут (как REST).
    await db.finding.deleteMany({
      where: { documentId: document.id, status: "open" },
    });
    const created = await Promise.all(
      drafts.map((draft) =>
        db.finding.create({
          data: {
            projectId: document.projectId,
            documentId: document.id,
            scope: document.kind === "spec" ? "spec" : "manuscript",
            ...draft,
          },
        }),
      ),
    );

    return {
      message:
        `Аналитик проверил «${document.title}»: ` +
        (created.length === 0
          ? "проблем не найдено"
          : `нашёл ${created.length} ${created.length === 1 ? "находку" : "находок"}`),
      document: { id: document.id, title: document.title },
      findings: created.map((f) => ({
        type: f.type,
        severity: f.severity,
        title: f.title,
        sourceRef: f.sourceRef,
      })),
    };
  },
};

// ─────────────────────────── tool: generate_image ───────────────────────────

const IMAGE_SIZES = new Set(["1024x1024", "1152x864", "864x1152", "1440x720", "720x1440"]);

const generateImage: ToolDef = {
  name: "generate_image",
  description:
    "Сгенерировать изображение по описанию и положить его в галерею (Альбом) воркспейса. Возвращает «Изображение готово: название» и URL. Воркспейс можно указать id или названием.",
  argsSchema: {
    projectId: "id воркспейса (или workspaceName)",
    workspaceId: "id воркспейса (альтернатива projectId)",
    workspaceName: "название воркспейса, если id нет",
    prompt: "описание изображения (обязательно, 3–4000 символов)",
    title: "название артефакта (необязательно)",
    size: "размер: 1024x1024|1152x864|864x1152|1440x720|720x1440 (по умолчанию 1024x1024)",
  },
  async execute(args: any, userId: string, _ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    const prompt = optString(args.prompt, 4_000);
    if (!prompt || prompt.length < 3) {
      return { error: "Аргумент prompt обязателен (описание изображения, 3–4000 символов)" };
    }
    const title = optString(args.title, 160);
    const sizeRaw = optString(args.size, 20);
    const size = sizeRaw && IMAGE_SIZES.has(sizeRaw) ? sizeRaw : "1024x1024";

    const ws = await resolveWorkspace(userId, args);
    if ("error" in ws) return { error: ws.error };

    try {
      const route = await resolveToolRoute(db, userId, "image");
      const { buffer } = await generateImage(route, { prompt, size });
      const url = saveGenFile(buffer, "png");
      const artifact = await db.artifact.create({
        data: {
          projectId: ws.id,
          type: "image",
          title: title ?? prompt.slice(0, 80),
          prompt,
          url,
        },
      });
      return {
        message: `Изображение готово: ${artifact.title}`,
        url,
        artifact: { id: artifact.id, title: artifact.title, type: "image" },
        workspace: ws.name,
      };
    } catch (err) {
      return {
        error:
          "Не удалось сгенерировать изображение: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }
  },
};

// ─────────────────────────── tool: tts_narration ───────────────────────────

const TTS_VOICES = [
  "tongtong", "chuichui", "xiaochen", "jam", "kazi", "douji", "luodo",
] as const;

const ttsNarration: ToolDef = {
  name: "tts_narration",
  description:
    "Озвучить текст голосом студии и положить трек в аудиобиблиотеку воркспейса. Возвращает «Озвучка готова» и URL WAV-файла. Воркспейс можно указать id или названием.",
  argsSchema: {
    projectId: "id воркспейса (или workspaceName)",
    workspaceId: "id воркспейса (альтернатива projectId)",
    workspaceName: "название воркспейса, если id нет",
    text: "текст озвучки (обязательно, 3–4000 символов)",
    title: "название озвучки (необязательно)",
    voice: "голос: tongtong|chuichui|xiaochen|jam|kazi|douji|luodo (по умолчанию tongtong)",
  },
  async execute(args: any, userId: string, _ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    const text = optString(args.text, 4_000);
    if (!text || text.length < 3) {
      return { error: "Аргумент text обязателен (текст озвучки, 3–4000 символов)" };
    }
    const title = optString(args.title, 160);
    const voiceRaw = optString(args.voice, 20);
    const voice = (TTS_VOICES as readonly string[]).includes(voiceRaw ?? "")
      ? voiceRaw!
      : "tongtong";

    const ws = await resolveWorkspace(userId, args);
    if ("error" in ws) return { error: ws.error };

    try {
      const route = await resolveToolRoute(db, userId, "tts");
      const buffer = await synthesizeSpeech(route, { text, voice, speed: 1.0 });
      if (buffer.length === 0) {
        return { error: "Озвучка вернула пустой файл — попробуйте ещё раз" };
      }

      const url = saveGenFile(buffer, "wav");
      const artifact = await db.artifact.create({
        data: {
          projectId: ws.id,
          type: "audio",
          title: title ?? `Озвучка: ${text.slice(0, 60)}${text.length > 60 ? "…" : ""}`,
          prompt: text.slice(0, 500),
          url,
          stage: "Озвучка",
          meta: JSON.stringify({ voice, chars: text.length }),
        },
      });
      return {
        message: `Озвучка готова: ${artifact.title}`,
        url,
        artifact: { id: artifact.id, title: artifact.title, type: "audio" },
        workspace: ws.name,
      };
    } catch (err) {
      return {
        error:
          "Не удалось озвучить текст: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }
  },
};

// ─────────────────────────── registry export ───────────────────────────

/** Инструменты контента воркспейсов (Фаза A) — добавляются в TOOLS tools.ts. */
export const WORKSPACE_TOOLS: ToolDef[] = [
  createEntity,
  checkDocument,
  generateImage,
  ttsNarration,
];
