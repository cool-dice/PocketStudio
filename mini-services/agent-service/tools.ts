// VibeFlow agent tools — Stage 1 notebook tool registry.
//
// The z-ai SDK has no native function calling, so tools are described in the
// system prompt (JSON protocol) and the model's JSON reply is parsed by
// agent.ts:parseToolCall. Every tool is userId-scoped and validates its args
// manually — invalid args return {error: "..."} instead of throwing, so the
// tool-calling loop in server.ts never crashes.
//
// Allowlists MUST stay in sync with the main app's notes REST contract
// (worklog Task 4, Task 1-a).

import { db } from "./db-client";

// ─────────────────────────── registry types ───────────────────────────

export interface ToolDef {
  name: string;
  description: string;
  /** Human-readable arg descriptions (shown in logs / debugging). */
  argsSchema: Record<string, string>;
  execute(args: any, userId: string): Promise<any>;
}

export const CATEGORY_COLORS = [
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

export const CATEGORY_ICONS = [
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

// ─────────────────────────── shared helpers ───────────────────────────

interface CategoryShape {
  id: string;
  name: string;
  color: string;
  icon: string;
}

function categoryShape(c: {
  id: string;
  name: string;
  color: string;
  icon: string;
}): CategoryShape {
  return { id: c.id, name: c.name, color: c.color, icon: c.icon };
}

/** First 140 chars of a note text as a single line. */
function makePreview(text: string | null): string {
  const single = (text ?? "").replace(/\s+/g, " ").trim();
  return single.length <= 140 ? single : single.slice(0, 140);
}

/**
 * limit arg: absent/invalid → default 10; out-of-range → clamped to 1..20.
 * (Lenient on purpose: an odd limit from the LLM should not fail the turn.)
 */
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

/** Find the user's category by exact name, case-insensitive (SQLite-aware). */
async function findCategoryByName(
  userId: string,
  name: string,
): Promise<{ id: string; name: string; color: string; icon: string } | null> {
  const lower = name.toLowerCase();
  const categories = await db.category.findMany({ where: { userId } });
  return categories.find((c) => c.name.toLowerCase() === lower) ?? null;
}

interface NoteWithCategory {
  id: string;
  rawText: string | null;
  status: string;
  favorite: boolean;
  createdAt: Date;
  category: { id: string; name: string; color: string; icon: string } | null;
}

/** Newest-first note feed row: {id, preview, category, createdAt}. */
function feedShape(n: NoteWithCategory) {
  return {
    id: n.id,
    preview: makePreview(n.rawText),
    category: n.category ? categoryShape(n.category) : null,
    createdAt: n.createdAt.toISOString(),
  };
}

// ─────────────────────────── tool: create_note ───────────────────────────

const createNote: ToolDef = {
  name: "create_note",
  description:
    "Записать заметку пользователя в блокнот. Возвращает созданную заметку и её категорию.",
  argsSchema: {
    text: "полный текст заметки (обязательно, 1–5000 символов)",
    category_name: "название категории (необязательно, 1–40 символов)",
    category_color:
      "цвет категории: emerald|amber|rose|sky|violet|stone|teal|orange|pink|cyan (по умолчанию stone)",
    category_icon:
      "иконка категории: lightbulb|briefcase|shopping-cart|heart|brain|zap|star|book|code|rocket|wallet|coffee (по умолчанию lightbulb)",
  },
  async execute(args: any, userId: string) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    // text (required, 1..5000 after trim)
    if (typeof args.text !== "string") {
      return { error: "Аргумент text обязателен и должен быть строкой" };
    }
    const text = args.text.trim();
    if (!text) return { error: "Текст заметки не может быть пустым" };
    if (text.length > 5000) {
      return { error: "Текст заметки слишком длинный (максимум 5000 символов)" };
    }

    // category_name (optional, 1..40 after trim; empty → treated as absent)
    let categoryName: string | null = null;
    if (args.category_name !== undefined && args.category_name !== null) {
      if (typeof args.category_name !== "string") {
        return { error: "Аргумент category_name должен быть строкой" };
      }
      const trimmed = args.category_name.trim();
      if (trimmed.length > 40) {
        return { error: "Название категории слишком длинное (максимум 40 символов)" };
      }
      categoryName = trimmed || null;
    }

    // category_color / category_icon — allowlist with default fallback
    // (invalid value from the LLM degrades to the default, not an error)
    const color =
      typeof args.category_color === "string" &&
      (CATEGORY_COLORS as readonly string[]).includes(args.category_color)
        ? args.category_color
        : DEFAULT_COLOR;
    const icon =
      typeof args.category_icon === "string" &&
      (CATEGORY_ICONS as readonly string[]).includes(args.category_icon)
        ? args.category_icon
        : DEFAULT_ICON;

    // Category: reuse the user's existing one (case-insensitive name match),
    // create a new one only when a name was given and nothing matched.
    let category = categoryName ? await findCategoryByName(userId, categoryName) : null;
    let createdNewCategory = false;

    if (categoryName && !category) {
      try {
        category = await db.category.create({
          data: { userId, name: categoryName, color, icon },
        });
        createdNewCategory = true;
      } catch (err) {
        // Race on the unique [userId, name] constraint → re-fetch the winner.
        const existing = await findCategoryByName(userId, categoryName);
        if (existing) {
          category = existing;
        } else {
          return {
            error: "Не удалось создать категорию: " + (err instanceof Error ? err.message : String(err)),
          };
        }
      }
    }

    const note = await db.note.create({
      data: {
        userId,
        rawText: text,
        status: "pending",
        categoryId: category?.id ?? null,
      },
    });

    return {
      note: {
        id: note.id,
        rawText: note.rawText,
        status: note.status,
        createdAt: note.createdAt.toISOString(),
      },
      category: category ? categoryShape(category) : null,
      createdNewCategory,
    };
  },
};

// ─────────────────────────── tool: search_notes ───────────────────────────

const searchNotes: ToolDef = {
  name: "search_notes",
  description: "Найти заметки пользователя по подстроке (без учёта регистра), новые сверху.",
  argsSchema: {
    query: "поисковый запрос (обязательно, 1–200 символов)",
    limit: "максимум результатов, 1–20 (по умолчанию 10)",
  },
  async execute(args: any, userId: string) {
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

    const limit = parseLimit(args.limit);

    // SQLite has no case-insensitive LIKE for non-ASCII (Russian) via Prisma
    // `contains`, so fetch the newest 500 notes and filter in JS.
    const needle = query.toLowerCase();
    const recent = await db.note.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { category: { select: { id: true, name: true, color: true, icon: true } } },
    });

    const notes = recent
      .filter((n) => (n.rawText ?? "").toLowerCase().includes(needle))
      .slice(0, limit)
      .map(feedShape);

    return { notes };
  },
};

// ─────────────────────────── tool: list_notes ───────────────────────────

const listNotes: ToolDef = {
  name: "list_notes",
  description: "Последние заметки пользователя (новые сверху).",
  argsSchema: {
    limit: "максимум результатов, 1–20 (по умолчанию 10)",
  },
  async execute(args: any, userId: string) {
    const limit =
      typeof args === "object" && args !== null ? parseLimit(args.limit) : 10;

    const notes = await db.note.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { category: { select: { id: true, name: true, color: true, icon: true } } },
    });

    return { notes: notes.map(feedShape) };
  },
};

// ─────────────────────────── tool: open_note ───────────────────────────

const openNote: ToolDef = {
  name: "open_note",
  description: "Открыть заметку целиком по её идентификатору.",
  argsSchema: {
    noteId: "идентификатор заметки (обязательно)",
  },
  async execute(args: any, userId: string) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    if (typeof args.noteId !== "string" || !args.noteId.trim()) {
      return { error: "Аргумент noteId обязателен и должен быть строкой" };
    }

    const note = await db.note.findFirst({
      where: { id: args.noteId.trim(), userId },
      include: { category: { select: { id: true, name: true, color: true, icon: true } } },
    });
    if (!note) return { error: "Заметка не найдена" };

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

// ─────────────────────────── registry ───────────────────────────

export const TOOLS: ToolDef[] = [createNote, searchNotes, listNotes, openNote];

export function getTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}
