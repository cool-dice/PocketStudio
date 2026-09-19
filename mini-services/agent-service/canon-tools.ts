/**
 * retrieve_canon / tag_note / set_reminder — proto1 inbox + proto2 RAG, SQLite.
 */

import { db } from "./db-client";
import { rankCanonHits } from "../../src/lib/retrieve";
import type { ToolContext, ToolDef } from "./tools";

function pickString(args: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = args[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

const retrieveCanon: ToolDef = {
  name: "retrieve_canon",
  description:
    "Найти канон воркспейса: заметки, главы документов и сущности по запросу. Не выдумывает факты.",
  argsSchema: {
    query: "поисковый запрос (обязательно)",
    workspaceId: "ограничить воркспейсом (необязательно — берётся из чата)",
    limit: "сколько хитов вернуть, 1–12",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const query = pickString(args, ["query", "q"]);
    if (!query) return { error: "Аргумент query обязателен" };
    const workspaceId =
      pickString(args, ["workspaceId", "projectId"]) ?? ctx.projectId ?? null;

    const noteWhere = workspaceId
      ? {
          userId,
          links: { some: { projectId: workspaceId } },
        }
      : { userId };
    const notes = await db.note.findMany({
      where: noteWhere,
      select: { id: true, rawText: true, links: { select: { projectId: true } } },
      orderBy: { updatedAt: "desc" },
      take: 120,
    });

    const sectionWhere = workspaceId
      ? { document: { project: { userId, id: workspaceId } } }
      : { document: { project: { userId } } };
    const sections = await db.documentSection.findMany({
      where: sectionWhere,
      select: {
        id: true,
        title: true,
        content: true,
        document: { select: { projectId: true, title: true } },
      },
      take: 80,
    });

    const entityWhere = workspaceId
      ? { project: { userId, id: workspaceId } }
      : { project: { userId } };
    const entities = await db.entity.findMany({
      where: entityWhere,
      select: {
        id: true,
        name: true,
        short: true,
        description: true,
        projectId: true,
      },
      take: 80,
    });

    const rows = [
      ...notes.map((n) => ({
        kind: "note" as const,
        id: n.id,
        title: "Заметка",
        body: n.rawText ?? "",
        workspaceId: n.links[0]?.projectId ?? workspaceId,
      })),
      ...sections.map((s) => ({
        kind: "section" as const,
        id: s.id,
        title: `${s.document.title} · ${s.title}`,
        body: s.content,
        workspaceId: s.document.projectId,
      })),
      ...entities.map((e) => ({
        kind: "entity" as const,
        id: e.id,
        title: e.name,
        body: [e.short, e.description].filter(Boolean).join("\n"),
        workspaceId: e.projectId,
      })),
    ];

    const limitRaw = typeof args.limit === "number" ? args.limit : Number(args.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(12, Math.max(1, Math.floor(limitRaw)))
      : 8;
    const hits = rankCanonHits(query, rows, limit);
    return {
      query,
      hits,
      message:
        hits.length === 0
          ? "В каноне ничего не нашлось — не выдумывай факты, спроси пользователя."
          : `Найдено ${hits.length} фрагментов канона.`,
    };
  },
};

const tagNote: ToolDef = {
  name: "tag_note",
  description: "Поставить теги на заметку пользователя (создаёт теги при необходимости).",
  argsSchema: {
    noteId: "id заметки",
    tags: "массив коротких тегов",
  },
  async execute(args: any, userId: string) {
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

    const note = await db.note.findFirst({ where: { id: noteId, userId } });
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
  description: "Назначить напоминание по заметке (ISO-8601 или относительное «завтра»).",
  argsSchema: {
    noteId: "id заметки",
    at: "ISO-8601 дата/время",
  },
  async execute(args: any, userId: string) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    const noteId = pickString(args, ["noteId", "id"]);
    if (!noteId) return { error: "Аргумент noteId обязателен" };
    const atRaw = pickString(args, ["at", "when", "remindAt"]);
    if (!atRaw) return { error: "Аргумент at обязателен (ISO-8601)" };
    const at = new Date(atRaw);
    if (Number.isNaN(at.getTime())) return { error: "Некорректная дата напоминания" };

    const note = await db.note.findFirst({ where: { id: noteId, userId } });
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

export const CANON_TOOLS: ToolDef[] = [retrieveCanon, tagNote, setReminder];
