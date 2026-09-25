/**
 * Notebook tools: create / search / list / open notes.
 * Workspace-scoped threads stay inside NoteLink of that studio.
 */

import { isToolUnconfigured } from "../../src/lib/ai/resolve";
import { noteAnalysisFieldsForQueue } from "../../src/lib/note-analysis";
import {
  NOTE_NOT_FOUND,
  notesWhereForScope,
} from "../../src/lib/note-scope";
import { resolveWorkspace } from "../../src/lib/resolve-workspace";
import { db } from "./db-client";
import { scheduleIndexNote } from "../../src/lib/rag/hooks";
import type { ToolContext, ToolDef } from "./tools";

export const NOTE_CATEGORY_COLORS = [
  "emerald",
  "amber",
  "rose",
  "sky",
  "violet",
  "stone",
  "teal",
  "orange",
  "pink",
  "cyan",
] as const;

export const NOTE_CATEGORY_ICONS = [
  "lightbulb",
  "briefcase",
  "shopping-cart",
  "heart",
  "brain",
  "zap",
  "star",
  "book",
  "code",
  "rocket",
  "wallet",
  "coffee",
] as const;

const DEFAULT_COLOR = "stone";
const DEFAULT_ICON = "lightbulb";

function categoryShape(c: {
  id: string;
  name: string;
  color: string;
  icon: string;
}) {
  return { id: c.id, name: c.name, color: c.color, icon: c.icon };
}

function makePreview(text: string | null): string {
  const single = (text ?? "").replace(/\s+/g, " ").trim();
  return single.length <= 140 ? single : single.slice(0, 140);
}

function parseLimit(value: unknown, fallback = 10): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== "" && !isNaN(Number(value))
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

function feedShape(n: {
  id: string;
  rawText: string | null;
  status: string;
  createdAt: Date;
  category: { id: string; name: string; color: string; icon: string } | null;
}) {
  return {
    id: n.id,
    preview: makePreview(n.rawText),
    category: n.category ? categoryShape(n.category) : null,
    createdAt: n.createdAt.toISOString(),
  };
}

async function findCategoryByName(userId: string, name: string) {
  const lower = name.toLowerCase();
  const categories = await db.category.findMany({ where: { userId } });
  return categories.find((c) => c.name.toLowerCase() === lower) ?? null;
}

async function resolveCategory(
  userId: string,
  args: Record<string, unknown>,
): Promise<
  | { category: { id: string; name: string; color: string; icon: string } | null; createdNewCategory: boolean }
  | { error: string }
> {
  if (args.category_name !== undefined && args.category_name !== null) {
    if (typeof args.category_name !== "string") {
      return { error: "Аргумент category_name должен быть строкой" };
    }
  }
  const trimmed =
    typeof args.category_name === "string" ? args.category_name.trim() : "";
  if (trimmed.length > 40) {
    return { error: "Название категории слишком длинное (максимум 40 символов)" };
  }
  const categoryName = trimmed || null;
  const color =
    typeof args.category_color === "string" &&
    (NOTE_CATEGORY_COLORS as readonly string[]).includes(args.category_color)
      ? args.category_color
      : DEFAULT_COLOR;
  const icon =
    typeof args.category_icon === "string" &&
    (NOTE_CATEGORY_ICONS as readonly string[]).includes(args.category_icon)
      ? args.category_icon
      : DEFAULT_ICON;

  if (!categoryName) return { category: null, createdNewCategory: false };
  const existing = await findCategoryByName(userId, categoryName);
  if (existing) return { category: existing, createdNewCategory: false };
  try {
    const created = await db.category.create({
      data: { userId, name: categoryName, color, icon },
    });
    return { category: created, createdNewCategory: true };
  } catch (err) {
    const winner = await findCategoryByName(userId, categoryName);
    if (winner) return { category: winner, createdNewCategory: false };
    return {
      error:
        "Не удалось создать категорию: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}

async function linkNote(noteId: string, projectId: string): Promise<void> {
  try {
    await db.noteLink.create({
      data: { noteId, projectId, kind: "context" },
    });
  } catch {
    // Unique [noteId, projectId] — already linked.
  }
}

const createNote: ToolDef = {
  name: "create_note",
  description:
    "Записать заметку. В чате воркспейса — только в эту студию. В главном чате можно указать workspaceName/workspaceId; без них — входящая заметка без связи.",
  argsSchema: {
    text: "полный текст заметки (обязательно, 1–5000 символов)",
    category_name: "название категории (необязательно, 1–40 символов)",
    category_color:
      "цвет категории: emerald|amber|rose|sky|violet|stone|teal|orange|pink|cyan",
    category_icon:
      "иконка категории: lightbulb|briefcase|shopping-cart|heart|brain|zap|star|book|code|rocket|wallet|coffee",
    workspaceId: "id воркспейса (главный чат; в студии игнорируется чужой id)",
    workspaceName: "название воркспейса (главный чат)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    if (typeof args.text !== "string") {
      return { error: "Аргумент text обязателен и должен быть строкой" };
    }
    const text = args.text.trim();
    if (!text) return { error: "Текст заметки не может быть пустым" };
    if (text.length > 5000) {
      return { error: "Текст заметки слишком длинный (максимум 5000 символов)" };
    }

    const cat = await resolveCategory(userId, args);
    if ("error" in cat) return { error: cat.error };

    const ws = await resolveWorkspace(db, userId, args, ctx, {
      required: false,
    });
    if (ws && "error" in ws) return { error: ws.error };

    const analysis = noteAnalysisFieldsForQueue(
      await isToolUnconfigured(db, userId, "notes"),
    );
    const note = await db.note.create({
      data: {
        userId,
        rawText: text,
        categoryId: cat.category?.id ?? null,
        ...analysis,
      },
    });
    if (ws) await linkNote(note.id, ws.id);
    scheduleIndexNote(db, note.id);
    return {
      note: {
        id: note.id,
        rawText: note.rawText,
        status: note.status,
        createdAt: note.createdAt.toISOString(),
      },
      category: cat.category ? categoryShape(cat.category) : null,
      createdNewCategory: cat.createdNewCategory,
      workspaceId: ws ? ws.id : null,
    };
  },
};

const NOTE_INCLUDE = {
  category: { select: { id: true, name: true, color: true, icon: true } },
} as const;

const searchNotes: ToolDef = {
  name: "search_notes",
  description:
    "Найти заметки по подстроке. В чате воркспейса — только заметки этой студии. В главном чате — все свои, можно сузить workspaceId/workspaceName.",
  argsSchema: {
    query: "поисковый запрос (обязательно, 1–200 символов)",
    limit: "максимум результатов, 1–20 (по умолчанию 10)",
    workspaceId: "сузить до студии (только главный чат)",
    workspaceName: "название студии для сужения (только главный чат)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    if (typeof args.query !== "string") {
      return { error: "Аргумент query обязателен и должен быть строкой" };
    }
    const query = args.query.trim();
    if (!query) return { error: "Поисковый запрос не может быть пустым" };
    if (query.length > 200) {
      return { error: "Поисковый запрос слишком длинный (максимум 200 символов)" };
    }
    const scope = await resolveNoteListScope(userId, args, ctx);
    if ("error" in scope) return { error: scope.error };
    const needle = query.toLowerCase();
    const recent = await db.note.findMany({
      where: notesWhereForScope(userId, scope.projectId) as any,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: NOTE_INCLUDE,
    });
    const notes = recent
      .filter((n) => (n.rawText ?? "").toLowerCase().includes(needle))
      .slice(0, parseLimit(args.limit))
      .map(feedShape);
    return { notes };
  },
};

const listNotes: ToolDef = {
  name: "list_notes",
  description:
    "Последние заметки. В чате воркспейса — только эта студия. В главном чате — все свои, можно сузить workspaceId/workspaceName.",
  argsSchema: {
    limit: "максимум результатов, 1–20 (по умолчанию 10)",
    workspaceId: "сузить до студии (только главный чат)",
    workspaceName: "название студии для сужения (только главный чат)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    const limit =
      typeof args === "object" && args !== null ? parseLimit(args.limit) : 10;
    const scope = await resolveNoteListScope(
      userId,
      typeof args === "object" && args !== null ? args : {},
      ctx,
    );
    if ("error" in scope) return { error: scope.error };
    const notes = await db.note.findMany({
      where: notesWhereForScope(userId, scope.projectId) as any,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: NOTE_INCLUDE,
    });
    return { notes: notes.map(feedShape) };
  },
};

const openNote: ToolDef = {
  name: "open_note",
  description:
    "Открыть заметку по id. В чате воркспейса чужие студии и входящие без связи недоступны.",
  argsSchema: {
    noteId: "идентификатор заметки (обязательно)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    if (typeof args.noteId !== "string" || !args.noteId.trim()) {
      return { error: "Аргумент noteId обязателен и должен быть строкой" };
    }
    const noteId = args.noteId.trim();
    const where = ctx.projectId
      ? {
          id: noteId,
          userId,
          links: { some: { projectId: ctx.projectId } },
        }
      : { id: noteId, userId };
    const note = await db.note.findFirst({
      where,
      include: NOTE_INCLUDE,
    });
    if (!note) return { error: NOTE_NOT_FOUND };
    return {
      id: note.id,
      rawText: note.rawText,
      status: note.status,
      favorite: note.favorite,
      createdAt: note.createdAt.toISOString(),
      category: note.category ? categoryShape(note.category) : null,
    };
  },
};

async function resolveNoteListScope(
  userId: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<{ projectId: string | null } | { error: string }> {
  if (ctx.projectId) return { projectId: ctx.projectId };
  const hasTarget =
    typeof args.workspaceId === "string" ||
    typeof args.projectId === "string" ||
    typeof args.workspaceName === "string" ||
    typeof args.projectName === "string";
  if (!hasTarget) return { projectId: null };
  const ws = await resolveWorkspace(db, userId, args, ctx, { required: true });
  if (!ws || "error" in ws) {
    return { error: ws && "error" in ws ? ws.error : "Воркспейс не найден" };
  }
  return { projectId: ws.id };
}

export const NOTE_TOOLS: ToolDef[] = [
  createNote,
  searchNotes,
  listNotes,
  openNote,
];
