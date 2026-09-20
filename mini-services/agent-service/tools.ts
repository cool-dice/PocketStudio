// PocketStudio agent tools — notebook + project/file tools.
//
// Модели отвечают JSON-протоколом, native function calling не требуется.
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

import { abortedToolResult, isAbortFlag, throwIfAborted } from "../../src/lib/abort-flag";
import { db } from "./db-client";
import { scheduleIndexFile } from "../../src/lib/rag/hooks";
import { removeFileChunks } from "../../src/lib/rag/indexer";
import { shouldSkipPath } from "../../src/lib/rag/skip";
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
  /** Turn abort from client `turn:abort` — long tools must check this. */
  signal?: AbortSignal;
}

export interface ToolDef {
  name: string;
  description: string;
  /** Human-readable arg descriptions (shown in logs / debugging). */
  argsSchema: Record<string, string>;
  /** MCP-адаптер (Фаза D): инструмент виден только при включённом сервере
   *  реестра интеграций ('filesystem' | 'fetch' | 'browser'). */
  mcpAdapter?: string;
  execute(args: any, userId: string, ctx: ToolContext): Promise<any>;
}

export {
  NOTE_CATEGORY_COLORS as CATEGORY_COLORS,
  NOTE_CATEGORY_ICONS as CATEGORY_ICONS,
} from "./note-tools";

// ─────────────────────────── shared helpers (project tools) ───────────────────────────

/** ctx.projectId missing → the model must create/select a project first. */
const NEED_PROJECT_ERROR = "Сначала создайте или выберите проект";

/** Mode guard message for write tools (contract 3-ctr §3/§4). */
const ACT_MODE_ERROR =
  "Это действие доступно только в режиме «Действовать» — переключите режим диалога";
const CHECKPOINT_MODE_ERROR =
  "Чекпоинты доступны только в режиме «Действовать» — переключите режим диалога";

/** Agent-side file caps (tighter than the REST 256KB cap). */
export const MAX_AGENT_FILE_BYTES = 200 * 1024;
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

const CREATIVE_STUDIO_TYPES = new Set(["music", "book", "film"]);
const CREATE_PROJECT_IN_STUDIO_ERROR =
  "В этой студии нельзя создать Next.js-приложение. Для песни, книги или фильма используйте заметки, документы и аудио. Новый воркспейс — create_workspace из главного чата.";

async function refuseCreateProjectInStudio(
  userId: string,
  ctx: ToolContext,
): Promise<string | null> {
  if (!ctx.projectId) return null;
  const current = await db.project.findFirst({
    where: { id: ctx.projectId, userId },
    select: { type: true, origin: true },
  });
  if (
    current?.origin === "workspace" &&
    CREATIVE_STUDIO_TYPES.has(current.type)
  ) {
    return CREATE_PROJECT_IN_STUDIO_ERROR;
  }
  return null;
}

const createProject: ToolDef = {
  name: "create_project",
  description:
    "Создать код-проект из шаблона Next.js (не песню/книгу/фильм). Только режим «Действовать». Для студии — create_workspace.",
  argsSchema: {
    name: "название проекта (обязательно, 1–80 символов)",
    description: "короткое описание проекта (необязательно, до 500 символов)",
    note_id: "идентификатор заметки, которую связать с проектом (необязательно)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }

    // Mutation guard: creating projects materializes real files — only
    // the «act» mode may do that (ask/plan/review must stay read-only).
    if (ctx.mode !== "act") return { error: ACT_MODE_ERROR };
    const studioBlock = await refuseCreateProjectInStudio(userId, ctx);
    if (studioBlock) return { error: studioBlock };

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
  description:
    "Все проекты пользователя (шаблоны Next.js и студии вместе). Для песни/книги/фильма предпочти list_workspaces.",
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
  mcpAdapter: "filesystem",
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
  mcpAdapter: "filesystem",
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
  mcpAdapter: "filesystem",
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
    throwIfAborted(ctx.signal);

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      throwIfAborted(ctx.signal);
      const root = projectRoot(loaded.project.id);
      const written = await writeWorkspaceFile(root, args.path.trim(), args.content, MAX_AGENT_FILE_BYTES);
      if (!shouldSkipPath(written.path)) {
        scheduleIndexFile(db, {
          userId,
          projectId: loaded.project.id,
          relPath: written.path,
          content: args.content,
        });
      }
      return written;
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ─────────────────────────── tool: apply_patch ───────────────────────────

const applyPatch: ToolDef = {
  mcpAdapter: "filesystem",
  name: "apply_patch",
  description:
    "Точечно заменить фрагмент файла активного проекта (oldText→newText или unified diff). Только режим «Действовать». Предпочтительнее write_file для существующих файлов.",
  argsSchema: {
    path: "путь к файлу внутри проекта",
    oldText: "точный фрагмент, который заменить (если не передан patch)",
    newText: "новый фрагмент",
    patch: "опциональный unified diff с hunk @@",
    replaceAll: "заменить все вхождения oldText (по умолчанию только первое)",
  },
  async execute(args: any, userId: string, ctx: ToolContext) {
    if (typeof args !== "object" || args === null) {
      return { error: "Некорректные аргументы инструмента" };
    }
    if (typeof args.path !== "string" || !args.path.trim()) {
      return { error: "Аргумент path обязателен и должен быть строкой" };
    }
    if (ctx.mode !== "act") return { error: ACT_MODE_ERROR };
    throwIfAborted(ctx.signal);

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      throwIfAborted(ctx.signal);
      const { applyPatchArgs } = await import("../../src/lib/apply-patch");
      const root = projectRoot(loaded.project.id);
      const file = await readWorkspaceFile(
        root,
        args.path.trim(),
        MAX_AGENT_FILE_BYTES,
      );
      const oldText =
        typeof args.oldText === "string" ? args.oldText : null;
      const newText =
        typeof args.newText === "string" ? args.newText : null;
      const patch = typeof args.patch === "string" ? args.patch : null;
      const { next, replacements } = applyPatchArgs({
        content: file.content,
        oldText,
        newText,
        patch,
        replaceAll: Boolean(args.replaceAll),
      });
      throwIfAborted(ctx.signal);
      const written = await writeWorkspaceFile(
        root,
        args.path.trim(),
        next,
        MAX_AGENT_FILE_BYTES,
      );
      if (!shouldSkipPath(written.path)) {
        scheduleIndexFile(db, {
          userId,
          projectId: loaded.project.id,
          relPath: written.path,
          content: next,
        });
      }
      return {
        path: written.path,
        replacements,
        size: written.size,
        message: `Правка ${written.path}: ${replacements} замен`,
      };
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ─────────────────────────── tool: delete_file ───────────────────────────

const deleteFile: ToolDef = {
  mcpAdapter: "filesystem",
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
    throwIfAborted(ctx.signal);

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      throwIfAborted(ctx.signal);
      const root = projectRoot(loaded.project.id);
      const deleted = await deleteWorkspacePath(root, args.path.trim());
      await removeFileChunks(db, userId, loaded.project.id, deleted.path);
      return deleted;
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
      return { error: err instanceof Error ? err.message : String(err) };
    }
  },
};

// ─────────────────────────── tool: checkpoint ───────────────────────────

const checkpointTool: ToolDef = {
  mcpAdapter: "filesystem",
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
    throwIfAborted(ctx.signal);

    const loaded = await loadProject(userId, ctx);
    if ("error" in loaded) return { error: loaded.error };

    try {
      const root = projectRoot(loaded.project.id);
      const cp = await checkpointProject(root, message);
      return { noop: cp.noop, commit: cp.commit, filesChanged: cp.filesChanged };
    } catch (err) {
      if (isAbortFlag(err)) return abortedToolResult();
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

// Инструменты контента воркспейсов (Фаза A) — определены в workspace-tools.ts.
// Инструменты MCP-адаптеров (Фаза D) — определены в mcp-tools.ts и гейтятся
// включёнными серверами реестра интеграций (server.ts).
import { WORKSPACE_TOOLS } from "./workspace-tools";
import { DESIGN_TOOLS } from "./design-tools";
import { MCP_TOOLS } from "./mcp-tools";
import { CANON_TOOLS } from "./canon-tools";
import { NOTE_TOOLS } from "./note-tools";
import { STUDIO_TOOLS } from "./studio-tools";

export const TOOLS: ToolDef[] = [
  ...NOTE_TOOLS,
  ...STUDIO_TOOLS,
  createProject,
  listProjects,
  listFiles,
  readFile,
  writeFile,
  applyPatch,
  deleteFile,
  checkpointTool,
  completeTask,
  ...CANON_TOOLS,
  ...WORKSPACE_TOOLS,
  ...DESIGN_TOOLS,
  ...MCP_TOOLS,
];

export function getTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}
