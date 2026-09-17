// VibeFlow agent tools — Stage 1 notebook tools + Stage 3 project/file tools.
//
// The z-ai SDK has no native function calling, so tools are described in the
// system prompt (JSON protocol) and the model's JSON reply is parsed by
// agent.ts:parseToolCall. Every tool is userId-scoped and validates its args
// manually — invalid args return {error: "..."} instead of throwing, so the
// tool-calling loop in server.ts never crashes.
//
// Project/file tools (Stage 3, worklog Task 3-ctr) wrap the pure-node
// workspace lib (../../src/lib/workspace — real files + git on disk) and are
// turn-context aware: server.ts passes ToolContext {threadId, mode,
// projectId} from the thread row. Write tools self-check the "act" mode.
// WS events (project:created / project:updated) are emitted by server.ts,
// NOT here — tools stay io-free.
//
// Allowlists MUST stay in sync with the main app's notes REST contract
// (worklog Task 4, Task 1-a).

import { db } from "./db-client";
import {
  projectRoot,
  createFromTemplate,
  initProjectGit,
  listWorkspaceTree,
  readWorkspaceFile,
  writeWorkspaceFile,
  deleteWorkspacePath,
  checkpointProject,
  removeProjectDir,
} from "../../src/lib/workspace";

// ─────────────────────────── registry types ───────────────────────────

/** Turn context (contract 3-ctr §3): filled by server.ts from the thread row.
 *  Notebook tools ignore it; project/file tools use it for the active
 *  project + the mode write-guard. */
export interface ToolContext {
  threadId: string;
  mode: string;
  projectId: string | null;
}

export interface ToolDef {
  name: string;
  description: string;
  /** Human-readable arg descriptions (shown in logs / debugging). */
  argsSchema: Record<string, string>;
  execute(args: any, userId: string, ctx: ToolContext): Promise<any>;
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

// ─────────────────────────── shared helpers (project tools) ───────────────────────────

/** ctx.projectId missing → the model must create/select a project first. */
const NEED_PROJECT_ERROR = "Сначала создайте или выберите проект";

/** Mode guard message for write tools (contract 3-ctr §3/§4). */
const ACT_MODE_ERROR =
  "Запись файлов доступна только в режиме «Действовать» — переключите режим диалога";
const CHECKPOINT_MODE_ERROR =
  "Чекпоинты доступны только в режиме «Действовать» — переключите режим диалога";

/** Agent-side file caps (tighter than the REST 256KB cap). */
const MAX_AGENT_FILE_BYTES = 200 * 1024;
/** Max entries returned to the LLM by list_files. */
const MAX_LIST_FILES_ENTRIES = 400;

interface ProjectRow {
  id: string;
  name: string;
  origin: string;
}

/** Load the ctx project with an owner check — shared by all file tools. */
async function loadProject(
  userId: string,
  ctx: ToolContext,
): Promise<{ project: ProjectRow } | { error: string }> {
  if (!ctx.projectId) return { error: NEED_PROJECT_ERROR };
  const project = await db.project.findFirst({
    where: { id: ctx.projectId, userId },
    select: { id: true, name: true, origin: true },
  });
  if (!project) return { error: "Проект не найден" };
  return { project };
}

/** Normalize a subdir arg: strip "./" prefixes and slashes, keep hidden
 *  names (".env") intact; rejects ".." segments. Returns "" for root. */
function normalizeSubdir(raw: string): string {
  let dir = raw.replace(/\\/g, "/").trim();
  dir = dir.replace(/^(\.\/)+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (dir === ".") return "";
  return dir;
}

// ─────────────────────────── tool: create_project ───────────────────────────

const createProject: ToolDef = {
  name: "create_project",
  description:
    "Создать проект из шаблона Next.js (реальные файлы и git-репозиторий) и привязать его к текущему диалогу. Возвращает проект, число файлов и корневые файлы.",
  argsSchema: {
    name: "название проекта (обязательно, 1–80 символов)",
    description: "короткое описание проекта (необязательно, до 500 символов)",
    note_id: "идентификатор заметки, которую связать с проектом (необязательно)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    // name (required, 1..80 after trim)
    if (typeof args.name !== "string") {
      return { error: "Аргумент name обязателен и должен быть строкой" };
    }
    const name = args.name.trim();
    if (!name) return { error: "Название проекта не может быть пустым" };
    if (name.length > 80) {
      return { error: "Название проекта слишком длинное (максимум 80 символов) }" };
    }

    // description (optional, ≤500 after trim)
    let description: string | null = null;
    if (args.description !== undefined && args.description !== null) {
      if (typeof args.description !== "string") {
        return { error: "Аргумент description должен быть строкой" };
      }
      const trimmed = args.description.trim();
      if (trimmed.length > 500) {
        return { error: "Описание слишком длинное (максимум 500 символов)" };
      }
      description = trimmed || null;
    }

    // note_id (optional string)
    let noteId: string | null = null;
    if (args.note_id !== undefined && args.note_id !== null) {
      if (typeof args.note_id !== "string") {
        return { error: "Аргумент note_id должен быть строкой" };
      }
      noteId = args.note_id.trim() || null;
    }

    // 1. DB row first (rootPath is filled once the workspace exists).
    const project = await db.project.create({
      data: { userId, name, description, origin: "template", rootPath: "" },
    });

    // 2. Materialize the workspace dir from the template + git init.
    const root = projectRoot(project.id);
    let tree: Awaited<ReturnType<typeof listWorkspaceTree>>;
    try {
      await createFromTemplate(root);
      await initProjectGit(root);
      tree = await listWorkspaceTree(root);
    } catch (err) {
      // Roll the row AND the directory back — no orphan state survives.
      await removeProjectDir(project.id).catch(() => {});
      await db.project.delete({ where: { id: project.id } }).catch(() => {});
      return {
        error:
          "Не удалось создать проект: " +
          (err instanceof Error ? err.message : String(err)),
      };
    }

    // 3. Fill rootPath now that the workspace exists.
    await db.project.update({ where: { id: project.id }, data: { rootPath: root } });

    // 4. Bind the current thread — only when it has no project yet.
    const thread = await db.thread.findUnique({ where: { id: ctx.threadId } });
    if (thread && thread.userId === userId && thread.projectId === null) {
      await db.thread.update({
        where: { id: thread.id },
        data: { projectId: project.id },
      });
    }

    // 5. Optional originating note link (kind "proposal": the agent turned
    //    the user's thought into a project). Unique race → already linked.
    if (noteId) {
      const note = await db.note.findFirst({ where: { id: noteId, userId } });
      if (note) {
        await db.noteLink
          .create({ data: { noteId: note.id, projectId: project.id, kind: "proposal" } })
          .catch(() => {});
      }
    }

    return {
      project: { id: project.id, name, origin: project.origin },
      filesCount: tree.entries.filter((e) => e.type === "file").length,
      rootFiles: tree.entries.filter((e) => !e.path.includes("/")).map((e) => e.path),
    };
  },
};

// ─────────────────────────── tool: list_projects ───────────────────────────

const listProjects: ToolDef = {
  name: "list_projects",
  description: "Проекты пользователя (новые сверху): идентификатор, название, источник.",
  argsSchema: {},
  async execute(_args: any, userId: string, _ctx: ToolContext) {
    const projects = await db.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true, origin: true, createdAt: true },
    });
    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        origin: p.origin,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  },
};

// ─────────────────────────── tool: list_files ───────────────────────────

const listFiles: ToolDef = {
  name: "list_files",
  description:
    "Файлы активного проекта (или его подкаталога): путь, тип, размер. Требуется активный проект в диалоге.",
  argsSchema: {
    path: "подкаталог внутри проекта (необязательно, по умолчанию — корень проекта)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    // path (optional subdir; prefix matching keeps it inside the project)
    let subdir = "";
    if (args.path !== undefined && args.path !== null) {
      if (typeof args.path !== "string") {
        return { error: "Аргумент path должен быть строкой" };
      }
      subdir = normalizeSubdir(args.path);
    }
    if (subdir.split("/").some((s) => s === "..")) {
      return { error: "Путь вне проекта запрещён" };
    }

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      const root = projectRoot(loaded.project.id);
      const tree = await listWorkspaceTree(root);

      // Scope to the subdir and re-base the paths relative to it.
      const prefix = subdir ? subdir + "/" : "";
      const scoped = tree.entries
        .filter((e) => (subdir ? e.path.startsWith(prefix) : true))
        .map((e) => ({
          path: subdir ? e.path.slice(prefix.length) : e.path,
          type: e.type,
          size: e.size,
        }))
        .filter((e) => e.path !== "");

      return {
        files: scoped.slice(0, MAX_LIST_FILES_ENTRIES),
        truncated: tree.truncated || scoped.length > MAX_LIST_FILES_ENTRIES,
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ─────────────────────────── tool: read_file ───────────────────────────

const readFile: ToolDef = {
  name: "read_file",
  description: "Прочитать текстовый файл активного проекта (до 200 КБ).",
  argsSchema: {
    path: "путь к файлу внутри проекта (обязательно)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    if (typeof args.path !== "string" || !args.path.trim()) {
      return { error: "Аргумент path обязателен и должен быть строкой" };
    }

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      const root = projectRoot(loaded.project.id);
      return await readWorkspaceFile(root, args.path.trim(), MAX_AGENT_FILE_BYTES);
    } catch (err) {
      // WorkspaceError messages are already Russian (файл не найден и т.п.).
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ─────────────────────────── tool: write_file ───────────────────────────

const writeFile: ToolDef = {
  name: "write_file",
  description:
    "Записать текстовый файл в активный проект (создание или перезапись, до 200 КБ). Доступен только в режиме «Действовать».",
  argsSchema: {
    path: "путь к файлу внутри проекта (обязательно)",
    content: "полное содержимое файла (обязательно, текст)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    if (typeof args.path !== "string" || !args.path.trim()) {
      return { error: "Аргумент path обязателен и должен быть строкой" };
    }
    if (typeof args.content !== "string") {
      return { error: "Аргумент content обязателен и должен быть строкой" };
    }

    // Write guard: only the «act» mode may mutate files.
    if (ctx.mode !== "act") return { error: ACT_MODE_ERROR };

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      const root = projectRoot(loaded.project.id);
      return await writeWorkspaceFile(root, args.path.trim(), args.content, MAX_AGENT_FILE_BYTES);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ─────────────────────────── tool: delete_file ───────────────────────────

const deleteFile: ToolDef = {
  name: "delete_file",
  description:
    "Удалить файл или папку в активном проекте. Доступен только в режиме «Действовать».",
  argsSchema: {
    path: "путь к файлу или папке внутри проекта (обязательно)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    if (typeof args.path !== "string" || !args.path.trim()) {
      return { error: "Аргумент path обязателен и должен быть строкой" };
    }

    // Write guard: only the «act» mode may mutate files.
    if (ctx.mode !== "act") return { error: ACT_MODE_ERROR };

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      const root = projectRoot(loaded.project.id);
      return await deleteWorkspacePath(root, args.path.trim());
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ─────────────────────────── tool: checkpoint ───────────────────────────

const checkpointTool: ToolDef = {
  name: "checkpoint",
  description:
    "Сохранить контрольную точку активного проекта (git-коммит всех изменений). Доступен только в режиме «Действовать».",
  argsSchema: {
    message:
      "сообщение коммита (необязательно, до 200 символов, по умолчанию «Агент: контрольная точка»)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    // message (optional; empty/absent → default — lenient like parseLimit)
    let message = "Агент: контрольная точка";
    if (args.message !== undefined && args.message !== null) {
      if (typeof args.message !== "string") {
        return { error: "Аргумент message должен быть строкой" };
      }
      const trimmed = args.message.trim();
      if (trimmed.length > 200) {
        return { error: "Сообщение чекпоинта слишком длинное (максимум 200 символов)" };
      }
      if (trimmed) message = trimmed;
    }

    // Write guard: only the «act» mode may commit.
    if (ctx.mode !== "act") return { error: CHECKPOINT_MODE_ERROR };

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      const root = projectRoot(loaded.project.id);
      const cp = await checkpointProject(root, message);
      return { noop: cp.noop, commit: cp.commit, filesChanged: cp.filesChanged };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ─────────────────────────── tool: complete_task ───────────────────────────

const completeTask: ToolDef = {
  name: "complete_task",
  description:
    "Отметить шаг плана диалога выполненным. Вызывай сразу после того, как закончил работу по шагу (номер — позиция в плане, начиная с 1).",
  argsSchema: {
    task: "номер шага плана (целое число, 1-based)",
  },
  async execute(args: any, _userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    // task number: 1-based position in the plan (lenient parse like parseLimit).
    const n =
      typeof args.task === "number"
        ? args.task
        : typeof args.task === "string" && args.task.trim() !== "" && !isNaN(Number(args.task))
          ? Number(args.task)
          : NaN;
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      return { error: "Аргумент task должен быть целым номером шага (от 1)" };
    }

    const tasks = await db.task.findMany({
      where: { threadId: ctx.threadId },
      orderBy: { order: "asc" },
    });
    if (tasks.length === 0) {
      return { error: "У диалога пока нет плана — сначала составьте план в режиме «План»" };
    }
    const target = tasks[n - 1] ?? null;
    if (!target) {
      return { error: `В плане ${tasks.length} шаг(ов) — шага №${n} нет` };
    }
    if (target.done) {
      return { task: { id: target.id, order: target.order, text: target.text, done: true }, noop: true };
    }

    const updated = await db.task.update({
      where: { id: target.id },
      data: { done: true },
    });
    return {
      task: { id: updated.id, order: updated.order, text: updated.text, done: updated.done },
    };
  },
};

// ─────────────────────────── registry ───────────────────────────

export const TOOLS: ToolDef[] = [
  createNote,
  searchNotes,
  listNotes,
  openNote,
  createProject,
  listProjects,
  listFiles,
  readFile,
  writeFile,
  deleteFile,
  checkpointTool,
  completeTask,
];

export function getTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}
