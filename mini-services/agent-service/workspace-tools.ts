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
import { fileURLToPath } from "node:url";

import { db } from "./db-client";
import { abortedToolResult, isAbortFlag } from "../../src/lib/abort-flag";
import { generateLLMResponse } from "./agent";
import {
  generateImage as gatewayGenerateImage,
  mapTtsVoice,
  synthesizeSpeech,
  chatCompletion,
  type ResolvedRoute,
} from "../../src/lib/ai/connector";
import { GatewayError } from "../../src/lib/ai/errors";
import { UNCONFIGURED_TOOL_MESSAGE } from "../../src/lib/ai/tools";
import {
  isUnconfiguredToolError,
  resolveToolRoute,
} from "../../src/lib/ai/resolve";
import {
  composeImagePrompt,
  DOCUMENT_ANALYST_SYSTEM,
  sectionSystemFor,
} from "../../src/lib/ai/prompts";
import { parseAnalystFindings } from "../../src/lib/finding-quotes";
import {
  scheduleIndexArtifact,
  scheduleIndexEntity,
  scheduleIndexFinding,
  scheduleIndexSection,
} from "../../src/lib/rag/hooks";
import {
  DEPLOY_ZIP_HINT,
  DOCKER_BUILD_LOCAL_ONLY,
  EMPTY_APP_BUILD_ERROR,
  deployWrongTypeMessage,
  hasBuildableAppFiles,
  hasDockerfile,
} from "../../src/lib/docker-copy";
import { generateWorkspaceDockerfile } from "../../src/lib/docker-file";
import { dockerBuildWorkspace } from "../../src/lib/docker-deploy";
import {
  exportProjectZip,
  listWorkspaceTree,
  projectRoot,
} from "../../src/lib/workspace";
import {
  sectionContentFromModelOutput,
  sectionContentFromToolArg,
} from "../../src/lib/section-content";
import type { ToolContext, ToolDef } from "./tools";
import {
  pickString,
  resolveWorkspace as resolveWorkspaceShared,
  type WorkspaceRow,
} from "../../src/lib/resolve-workspace";

// ─────────────────────────── shared helpers ───────────────────────────

/** Абсолютный путь до public/gen основного Next-приложения (корень репо). */
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const GEN_DIR = path.join(REPO_ROOT, "public", "gen");

/** Сохранить бинарник в public/gen и вернуть публичный URL. */
function saveGenFile(data: Buffer, ext: "png" | "wav"): string {
  fs.mkdirSync(GEN_DIR, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(GEN_DIR, name), data);
  return `/gen/${name}`;
}

async function resolveWorkspace(
  userId: string,
  args: Record<string, unknown>,
  ctx?: ToolContext,
): Promise<WorkspaceRow | { error: string }> {
  const result = await resolveWorkspaceShared(db, userId, args, ctx, {
    required: true,
  });
  if (result === null) {
    return {
      error:
        "Укажите воркспейс: откройте чат внутри воркспейса или передайте workspaceId / workspaceName",
    };
  }
  return result;
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
  async execute(args: any, userId: string, ctx: ToolContext) {
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

    const ws = await resolveWorkspace(userId, args, ctx);
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

    scheduleIndexEntity(db, entity.id);

    return {
      message: `Сущность создана: ${entity.name} (${entity.kind})`,
      workspaceId: ws.id,
      entity: {
        id: entity.id,
        name: entity.name,
        kind: entity.kind,
        domain: entity.domain,
        setName: entity.setName,
        workspace: ws.name,
        workspaceId: ws.id,
      },
    };
  },
};

// ─────────────────────────── tool: check_document ───────────────────────────

/** Промпт Аналитика — src/lib/ai/prompts.ts DOCUMENT_ANALYST_SYSTEM. */

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

function parseFindings(raw: string, documentText: string) {
  return parseAnalystFindings(extractJson(raw), documentText);
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
  async execute(args: any, userId: string, ctx: ToolContext) {
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

      const ws = await resolveWorkspace(userId, args, ctx);
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

    // 3. LLM-анализ через шлюз (промпт как у Аналитика Next-стороны).
    let drafts: ReturnType<typeof parseFindings>;
    try {
      const raw = await generateLLMResponse(DOCUMENT_ANALYST_SYSTEM, [
        { role: "user", content: docText },
      ], { userId, toolId: "document_check", jsonMode: true, signal: ctx.signal });
      drafts = parseFindings(raw, docText);
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
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
    for (const f of created) scheduleIndexFinding(db, f.id);

    return {
      message:
        `Аналитик проверил «${document.title}»: ` +
        (created.length === 0
          ? "проблем не найдено"
          : `нашёл ${created.length} ${created.length === 1 ? "находку" : "находок"}`),
      workspaceId: document.projectId,
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
  async execute(args: any, userId: string, ctx: ToolContext) {
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

    const ws = await resolveWorkspace(userId, args, ctx);
    if ("error" in ws) return { error: ws.error };

    try {
      const route = await resolveToolRoute(db, userId, "image");
      const { buffer } = await gatewayGenerateImage(route, {
        prompt: composeImagePrompt(prompt),
        size,
        signal: ctx.signal,
      });
      if (buffer.length === 0) {
        return { error: "Генерация вернула пустой файл — попробуйте ещё раз" };
      }
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
      scheduleIndexArtifact(db, artifact.id);
      return {
        message: `Изображение готово: ${artifact.title}`,
        url,
        workspaceId: ws.id,
        artifact: { id: artifact.id, title: artifact.title, type: "image" },
        workspace: ws.name,
      };
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
      if (err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE) {
        return { error: UNCONFIGURED_TOOL_MESSAGE };
      }
      return {
        error:
          "Не удалось сгенерировать изображение: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }
  },
};

// ─────────────────────────── tool: tts_narration ───────────────────────────

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
    voice: "голос OpenAI: alloy|nova|shimmer|echo|onyx|fable|sage (по умолчанию alloy)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    const text = optString(args.text, 4_000);
    if (!text || text.length < 3) {
      return { error: "Аргумент text обязателен (текст озвучки, 3–4000 символов)" };
    }
    const title = optString(args.title, 160);
    const voice = mapTtsVoice(optString(args.voice, 20) ?? undefined);

    const ws = await resolveWorkspace(userId, args, ctx);
    if ("error" in ws) return { error: ws.error };

    try {
      const route = await resolveToolRoute(db, userId, "tts");
      const buffer = await synthesizeSpeech(route, {
        text,
        voice,
        speed: 1.0,
        signal: ctx.signal,
      });
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
      scheduleIndexArtifact(db, artifact.id);
      return {
        message: `Озвучка готова: ${artifact.title}`,
        url,
        workspaceId: ws.id,
        artifact: { id: artifact.id, title: artifact.title, type: "audio" },
        workspace: ws.name,
      };
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
      if (err instanceof GatewayError && err.message === UNCONFIGURED_TOOL_MESSAGE) {
        return { error: UNCONFIGURED_TOOL_MESSAGE };
      }
      return {
        error:
          "Не удалось озвучить текст: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }
  },
};

const DOC_KINDS = ["manuscript", "spec", "article", "script"] as const;

const createDocument: ToolDef = {
  name: "create_document",
  description:
    "Создать документ (рукопись/спека/статья/сценарий) в воркспейсе с первой главой. Если чат открыт внутри воркспейса, id можно не передавать.",
  argsSchema: {
    title: "название документа (обязательно, 1–120 символов)",
    content: "текст первой главы (необязательно)",
    sectionTitle: "заголовок первой главы (необязательно, по умолчанию Глава 1)",
    kind: "manuscript|spec|article|script (необязательно)",
    workspaceId: "id воркспейса, если чат не привязан",
    workspaceName: "название воркспейса",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const title = optString(args.title, 120);
    if (!title) return { error: "Аргумент title обязателен (название документа)" };
    const kindRaw = optString(args.kind, 20);
    const kind =
      kindRaw && (DOC_KINDS as readonly string[]).includes(kindRaw)
        ? kindRaw
        : null;
    const sectionTitle = optString(args.sectionTitle, 120) ?? "Глава 1";
    const content = sectionContentFromToolArg(args.content);

    const ws = await resolveWorkspace(userId, args, ctx);
    if ("error" in ws) return { error: ws.error };

    const document = await db.document.create({
      data: {
        projectId: ws.id,
        title,
        kind: kind ?? (ws.type === "app" ? "spec" : ws.type === "film" ? "script" : "manuscript"),
        sections: {
          create: { title: sectionTitle, order: 0, content },
        },
      },
      include: { sections: { orderBy: { order: "asc" } } },
    });
    const first = document.sections[0];
    if (first) scheduleIndexSection(db, first.id);
    return {
      message: `Документ создан: ${document.title}`,
      workspaceId: ws.id,
      document: {
        id: document.id,
        title: document.title,
        kind: document.kind,
        sectionId: first?.id ?? null,
      },
    };
  },
};

const appendSection: ToolDef = {
  name: "append_section",
  description:
    "Добавить главу/раздел в существующий документ воркспейса.",
  argsSchema: {
    documentId: "id документа (обязательно, если нет title)",
    documentTitle: "название документа, если id неизвестен",
    title: "заголовок главы (обязательно)",
    content: "текст главы (необязательно)",
    workspaceId: "id воркспейса, если чат не привязан",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const sectionTitle = optString(args.title, 120);
    if (!sectionTitle) return { error: "Аргумент title обязателен (заголовок главы)" };
    const content = sectionContentFromToolArg(args.content);

    let documentId = pickString(args, ["documentId"]);
    if (!documentId) {
      const ws = await resolveWorkspace(userId, args, ctx);
      if ("error" in ws) return { error: ws.error };
      const want = pickString(args, ["documentTitle"]);
      const docs = await db.document.findMany({
        where: { projectId: ws.id },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
      });
      const found = want
        ? docs.find((d) => d.title.toLowerCase().includes(want.toLowerCase()))
        : docs[0];
      if (!found) return { error: "В воркспейсе нет документа — сначала create_document" };
      documentId = found.id;
    }

    const document = await db.document.findFirst({
      where: { id: documentId },
      include: { project: { select: { userId: true } }, sections: { select: { order: true } } },
    });
    if (!document || document.project.userId !== userId) {
      return { error: "Документ не найден" };
    }
    const nextOrder =
      document.sections.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    const section = await db.documentSection.create({
      data: {
        documentId: document.id,
        title: sectionTitle,
        order: nextOrder,
        content,
      },
    });
    scheduleIndexSection(db, section.id);
    return {
      message: `Глава добавлена: ${section.title}`,
      workspaceId: document.projectId,
      section: { id: section.id, title: section.title, documentId: document.id },
    };
  },
};

const rewriteSection: ToolDef = {
  name: "rewrite_section",
  description:
    "Переписать, продолжить или написать главу документа. Старый текст сохраняется в истории версий.",
  argsSchema: {
    documentId: "id документа (необязательно, если чат в воркспейсе)",
    documentTitle: "название документа, если id неизвестен",
    sectionTitle: "заголовок главы, если не первая",
    action: "write|rewrite|continue (по умолчанию rewrite; пустая глава → write)",
    instruction: "своя инструкция правки (необязательно)",
    workspaceId: "id воркспейса, если чат не привязан",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const actionRaw = optString(args.action, 20) ?? "rewrite";
    const action =
      actionRaw === "continue"
        ? "continue"
        : actionRaw === "write"
          ? "write"
          : actionRaw === "custom"
            ? "custom"
            : "rewrite";
    const instruction = optString(args.instruction, 2_000);

    let route: ResolvedRoute;
    try {
      route = await resolveToolRoute(db, userId, "rewrite_section");
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
      if (isUnconfiguredToolError(err)) {
        return { error: UNCONFIGURED_TOOL_MESSAGE };
      }
      const msg = err instanceof Error ? err.message : "Не удалось переписать главу";
      return { error: msg };
    }

    let documentId = pickString(args, ["documentId"]);
    if (!documentId) {
      const ws = await resolveWorkspace(userId, args, ctx);
      if ("error" in ws) return { error: ws.error };
      const want = pickString(args, ["documentTitle"]);
      const docs = await db.document.findMany({
        where: { projectId: ws.id },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
      });
      const found = want
        ? docs.find((d) => d.title.toLowerCase().includes(want.toLowerCase()))
        : docs[0];
      if (!found) return { error: "В воркспейсе нет документа — сначала create_document" };
      documentId = found.id;
    }

    const document = await db.document.findFirst({
      where: { id: documentId },
      include: {
        project: { select: { userId: true } },
        sections: { orderBy: { order: "asc" } },
      },
    });
    if (!document || document.project.userId !== userId) {
      return { error: "Документ не найден" };
    }
    const wantSection = pickString(args, ["sectionTitle", "title"]);
    const section = wantSection
      ? document.sections.find((s) =>
          s.title.toLowerCase().includes(wantSection.toLowerCase()),
        )
      : document.sections[0];
    if (!section) return { error: "В документе нет глав" };

    const system = sectionSystemFor(
      action,
      !section.content.trim(),
    );
    const user = [
      `Глава: ${section.title}`,
      "",
      section.content.trim() || "(пусто — напиши с нуля)",
      instruction ? `\nИнструкция: ${instruction}` : "",
    ].join("\n");

    try {
      const result = await chatCompletion(route, [
        { role: "system", content: system },
        { role: "user", content: user },
      ], { signal: ctx.signal });
      const generated = result.text.trim();
      if (!generated) return { error: "Модель вернула пустой текст" };
      const nextContent = sectionContentFromModelOutput(
        action,
        section.content,
        generated,
      );
      if (nextContent !== section.content) {
        await db.documentSectionRevision
          .create({
            data: {
              sectionId: section.id,
              content: section.content,
              source: "ai",
              size: section.content.length,
            },
          })
          .catch(() => {});
      }
      await db.documentSection.update({
        where: { id: section.id },
        data: { content: nextContent },
      });
      scheduleIndexSection(db, section.id);
      await db.document.update({
        where: { id: document.id },
        data: { updatedAt: new Date() },
      });
      return {
        message: action === "continue" ? `Глава продолжена: ${section.title}` : `Глава переписана: ${section.title}`,
        workspaceId: document.projectId,
        section: { id: section.id, title: section.title, documentId: document.id },
      };
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
      if (isUnconfiguredToolError(err)) {
        return { error: UNCONFIGURED_TOOL_MESSAGE };
      }
      const msg = err instanceof Error ? err.message : "Не удалось переписать главу";
      return { error: msg };
    }
  },
};

const FAKE_PUBLISH = /опубликовано на|published to registry|push succeeded|деплой завершён/i;

function neverPublished<T extends Record<string, unknown>>(result: T): T & { published: false } {
  const blob = JSON.stringify(result);
  if (FAKE_PUBLISH.test(blob) || /"published":true/.test(blob)) {
    return {
      ...result,
      published: false,
      message:
        typeof result.message === "string"
          ? result.message
          : "Локальная сборка. Образ не опубликован.",
    };
  }
  return { ...result, published: false };
}

const deployProject: ToolDef = {
  name: "deploy_project",
  description:
    "Подготовить приложение к локальной сборке: ZIP, Dockerfile и docker build. Только воркспейс типа app. Пустой проект не «собрано». Без Docker — честный unavailable. Никогда не публикация в реестр.",
  argsSchema: {
    workspaceId: "id воркспейса-приложения (или workspaceName)",
    workspaceName: "название воркспейса, если id нет",
    overwriteDockerfile: "перезаписать Dockerfile, если уже есть (по умолчанию нет)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    const ws = await resolveWorkspace(userId, args, ctx);
    if ("error" in ws) return { error: ws.error };
    if (ws.type !== "app") {
      return neverPublished({
        error: deployWrongTypeMessage(ws.type),
        status: "refused",
        published: false,
        imageTag: null,
        message: deployWrongTypeMessage(ws.type),
      });
    }

    const project = await db.project.findFirst({
      where: { id: ws.id, userId },
      select: { id: true, name: true, type: true, rootPath: true },
    });
    if (!project) return { error: "Воркспейс не найден" };

    const root = project.rootPath || projectRoot(project.id);
    let files: { path: string; type: string }[] = [];
    try {
      files = (await listWorkspaceTree(root)).entries;
    } catch {
      files = [];
    }

    const overwrite =
      args.overwriteDockerfile === true || args.overwrite === true;

    const packZip = async (): Promise<{ zipReady: boolean; zipBytes: number | null }> => {
      try {
        const zipPath = await exportProjectZip(root);
        try {
          const st = await fs.promises.stat(zipPath);
          return { zipReady: true, zipBytes: st.size };
        } finally {
          await fs.promises.rm(zipPath, { force: true }).catch(() => {});
        }
      } catch {
        return { zipReady: false, zipBytes: null };
      }
    };

    const emptyTree = !hasBuildableAppFiles(files);

    if (emptyTree) {
      const zip = await packZip();
      return neverPublished({
        status: "empty",
        published: false,
        imageTag: null,
        message: EMPTY_APP_BUILD_ERROR,
        log: EMPTY_APP_BUILD_ERROR,
        zipHint: DEPLOY_ZIP_HINT,
        zipReady: zip.zipReady,
        zipBytes: zip.zipBytes,
        workspace: { id: project.id, name: project.name, type: project.type },
      });
    }

    let dockerfileKind: string | null = null;
    if (!hasDockerfile(files) || overwrite) {
      const generated = await generateWorkspaceDockerfile(root, overwrite || !hasDockerfile(files));
      if (generated.ok) {
        dockerfileKind = generated.kind;
      } else if (!generated.conflict) {
        return neverPublished({
          error: generated.error,
          status: "failed",
          published: false,
          imageTag: null,
          message: generated.error,
        });
      }
    }

    const build = await dockerBuildWorkspace(project.id, root);
    const zip = await packZip();

    let message: string;
    if (build.status === "empty") {
      message = build.error ?? EMPTY_APP_BUILD_ERROR;
    } else if (build.status === "unavailable") {
      message = build.log;
    } else if (build.status === "built") {
      message = DOCKER_BUILD_LOCAL_ONLY;
    } else {
      message = build.log || "docker build не удался. Образ не опубликован.";
    }
    if (!message.includes(DEPLOY_ZIP_HINT)) {
      message = `${message}\n${DEPLOY_ZIP_HINT}`;
    }

    return neverPublished({
      status: build.status,
      published: false,
      imageTag: build.imageTag,
      log: build.log,
      message,
      dockerfileKind,
      zipHint: DEPLOY_ZIP_HINT,
      zipReady: zip.zipReady,
      zipBytes: zip.zipBytes,
      workspace: { id: project.id, name: project.name, type: project.type },
    });
  },
};

// ─────────────────────────── registry export ───────────────────────────

/** Инструменты контента воркспейсов (Фаза A) — добавляются в TOOLS tools.ts. */
export const WORKSPACE_TOOLS: ToolDef[] = [
  createEntity,
  checkDocument,
  generateImage,
  ttsNarration,
  createDocument,
  appendSection,
  rewriteSection,
  deployProject,
];
