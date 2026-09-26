/**
 * retrieve_canon / retrieve_code / tag_note / set_reminder.
 * RAG is scoped from the open thread — never from a model-supplied foreign workspaceId.
 */

import { abortedToolResult, isAbortFlag, throwIfAborted } from "../../src/lib/abort-flag";
import { db } from "./db-client";
import { retrieve } from "../../src/lib/rag/retrieve";
import { resolveRetrieveScope } from "../../src/lib/rag/scope";
import { RAG_SOURCE_TYPES } from "../../src/lib/rag/types";
import type { ToolContext, ToolDef } from "./tools";

function pickString(args: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function parseKinds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const kinds = raw
    .map((k) => String(k))
    .filter((k) => (RAG_SOURCE_TYPES as readonly string[]).includes(k));
  return kinds.length ? kinds : undefined;
}

async function runRetrieve(
  args: Record<string, unknown>,
  userId: string,
  ctx: ToolContext,
  forcedKinds?: string[],
) {
  const query = pickString(args, ["query", "q"]);
  if (!query) return { error: "Аргумент query обязателен" };

  const requested = pickString(args, ["workspaceId", "projectId"]);
  const scope = resolveRetrieveScope({
    userId,
    threadProjectId: ctx.projectId,
    requestedProjectId: requested,
  });

  if (scope.kind === "workspace" && scope.projectId) {
    const owned = await db.project.findFirst({
      where: { id: scope.projectId, userId },
      select: { id: true, name: true, type: true },
    });
    if (!owned) return { error: "Воркспейс не найден" };
  }

  const limitRaw = typeof args.limit === "number" ? args.limit : Number(args.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(12, Math.max(1, Math.floor(limitRaw)))
    : 8;
  const kinds = forcedKinds ?? parseKinds(args.kinds);

  throwIfAborted(ctx.signal);
  let result;
  try {
    result = await retrieve(db, { scope, query, kinds, limit, signal: ctx.signal });
  } catch (err) {
    if (isAbortFlag(err) || ctx.signal?.aborted) return abortedToolResult();
    throw err;
  }
  const hits = result.hits.map((h) => ({
    kind: h.kind,
    id: h.sourceId,
    title: h.title,
    excerpt: h.excerpt,
    workspaceId: h.workspaceId,
    workspaceName: h.workspaceName,
    path: h.path,
  }));

  const isolation =
    result.scope === "workspace"
      ? "Только этот воркспейс — чужой канон и чужой код недоступны."
      : "Главный чат: фрагменты со всех ваших воркспейсов. Цитируйте имя студии.";

  return {
    query: result.query,
    scope: result.scope,
    mode: result.mode,
    notice: result.notice,
    isolation,
    hits,
    message:
      hits.length === 0
        ? result.notice
          ? `Ничего не найдено (${result.notice}). Не выдумывай факты.`
          : "В каноне ничего не нашлось — не выдумывай факты, спроси пользователя."
        : `Найдено ${hits.length} фрагментов${result.notice ? ` (${result.notice})` : ""}.`,
  };
}

const retrieveCanon: ToolDef = {
  name: "retrieve_canon",
  description:
    "RAG по канону: заметки, главы, сущности, артефакты, код, скиллы. Скоуп берётся из чата (главный = все воркспейсы пользователя; чат воркспейса = только он). Не выдумывает факты.",
  argsSchema: {
    query: "поисковый запрос (обязательно)",
    kinds: "опционально: note|section|entity|artifact|file|thread|skill|finding",
    limit: "сколько хитов вернуть, 1–12",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    return runRetrieve(args, userId, ctx);
  },
};

const retrieveCode: ToolDef = {
  name: "retrieve_code",
  description:
    "То же, что retrieve_canon с kinds=['file']: код активного воркспейса (в главном чате — файлы всех репозиториев пользователя). Не читает чужие воркспейсы.",
  argsSchema: {
    query: "что искать в коде",
    limit: "сколько фрагментов, 1–12",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    return runRetrieve(args, userId, ctx, ["file"]);
  },
};

async function loadScopedNote(userId: string, noteId: string, ctx: ToolContext) {
  const where = ctx.projectId
    ? { id: noteId, userId, links: { some: { projectId: ctx.projectId } } }
    : { id: noteId, userId };
  return db.note.findFirst({ where });
}

const tagNote: ToolDef = {
  name: "tag_note",
  description:
    "Поставить теги на заметку. В чате воркспейса — только заметки этой студии.",
  argsSchema: {
    noteId: "id заметки",
    tags: "массив коротких тегов",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const noteId = pickString(args, ["noteId", "id"]);
    if (!noteId) return { error: "Аргумент noteId обязателен" };
    const rawTags = Array.isArray(args.tags)
      ? args.tags
      : typeof args.tags === "string"
        ? args.tags.split(",")
        : [];
    const names = rawTags
      .map((t) => String(t).trim().replace(/^#/, "").slice(0, 32))
      .filter(Boolean)
      .slice(0, 8);
    if (names.length === 0) return { error: "Нужен хотя бы один тег" };

    const note = await loadScopedNote(userId, noteId, ctx);
    if (!note) return { error: "Заметка не найдена" };

    const attached: string[] = [];
    for (const name of names) {
      const tag =
        (await db.tag.findFirst({
          where: { userId, name: { equals: name } },
        })) ??
        (await db.tag.create({
          data: { userId, name, color: "stone" },
        }));
      await db.noteTag.upsert({
        where: { noteId_tagId: { noteId, tagId: tag.id } },
        create: { noteId, tagId: tag.id },
        update: {},
      });
      attached.push(tag.name);
    }
    return { noteId, tags: attached, message: `Теги: ${attached.join(", ")}` };
  },
};

const setReminder: ToolDef = {
  name: "set_reminder",
  description:
    "Назначить напоминание по заметке (ISO-8601 или относительное «завтра»). В чате воркспейса — только заметки этой студии.",
  argsSchema: {
    noteId: "id заметки",
    at: "ISO-8601 дата/время",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const noteId = pickString(args, ["noteId", "id"]);
    if (!noteId) return { error: "Аргумент noteId обязателен" };
    const atRaw = pickString(args, ["at", "when", "remindAt"]);
    if (!atRaw) return { error: "Аргумент at обязателен (ISO-8601)" };
    const at = new Date(atRaw);
    if (Number.isNaN(at.getTime())) return { error: "Некорректная дата напоминания" };

    const note = await loadScopedNote(userId, noteId, ctx);
    if (!note) return { error: "Заметка не найдена" };

    await db.note.update({
      where: { id: noteId },
      data: { remindAt: at },
    });
    return {
      noteId,
      remindAt: at.toISOString(),
      message: `Напоминание на ${at.toISOString()}`,
    };
  },
};

export const CANON_TOOLS: ToolDef[] = [retrieveCanon, retrieveCode, tagNote, setReminder];
