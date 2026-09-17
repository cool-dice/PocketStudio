"use client";

/**
 * ToolCard — compact system card for role:"tool" chat rows (agent tool calls).
 * Running state: spinner + pulse. Done: subtle emerald check + readable
 * result summary. Raw args/result JSON stays behind a «подробнее» toggle
 * (project tools render a friendly preview instead of raw JSON).
 * Deliberately muted so it never reads as user/assistant text.
 */

import { memo, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Eye,
  FileCode2,
  FileSearch,
  FolderGit2,
  FolderKanban,
  FolderTree,
  GitCommitHorizontal,
  List,
  Loader2,
  NotebookPen,
  Search,
  Trash2,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { ChatMessage } from "@/lib/types";
import { formatBytes, pluralFiles, textPreview } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ToolMeta {
  icon: LucideIcon;
  running: string;
  done: string;
}

const TOOL_META: Record<string, ToolMeta> = {
  create_note: {
    icon: NotebookPen,
    running: "Создаю заметку…",
    done: "Заметка создана",
  },
  search_notes: {
    icon: Search,
    running: "Ищу заметки…",
    done: "Заметки найдены",
  },
  list_notes: {
    icon: List,
    running: "Загружаю заметки…",
    done: "Заметки загружены",
  },
  open_note: {
    icon: Eye,
    running: "Открываю заметку…",
    done: "Заметка открыта",
  },
  /* ── Project tools (Stage 3) ── */
  create_project: {
    icon: FolderGit2,
    running: "Создаю проект…",
    done: "Проект создан",
  },
  list_projects: {
    icon: FolderKanban,
    running: "Загружаю проекты…",
    done: "Проекты",
  },
  list_files: {
    icon: FolderTree,
    running: "Читаю файлы проекта…",
    done: "Файлы проекта",
  },
  read_file: {
    icon: FileSearch,
    running: "Читаю файл…",
    done: "Файл прочитан",
  },
  write_file: {
    icon: FileCode2,
    running: "Записываю файл…",
    done: "Файл записан",
  },
  delete_file: {
    icon: Trash2,
    running: "Удаляю файл…",
    done: "Файл удалён",
  },
  checkpoint: {
    icon: GitCommitHorizontal,
    running: "Делаю чекпоинт…",
    done: "Чекпоинт",
  },
};

const FALLBACK_META: ToolMeta = {
  icon: Wrench,
  running: "Работаю…",
  done: "Готово",
};

function safeParse(json: string | null | undefined): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Tool accent color (running spinner + done check). */
function toolAccent(tool: string): string {
  if (tool === "delete_file") return "text-rose-500";
  if (tool === "create_project") return "text-emerald-500";
  return "text-primary";
}

/** Human-readable one-liner for a finished tool result. */
function summarizeResult(tool: string, result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null;
  const r = result as Record<string, unknown>;

  if (typeof r.error === "string") return `Ошибка: ${r.error}`;

  if (tool === "create_note") {
    const note = r.note as { rawText?: unknown } | undefined;
    return typeof note?.rawText === "string"
      ? textPreview(note.rawText, 160)
      : null;
  }

  if (tool === "open_note") {
    return typeof r.rawText === "string" ? textPreview(r.rawText, 160) : null;
  }

  if (tool === "search_notes" || tool === "list_notes") {
    const notes = Array.isArray(r.notes) ? r.notes : [];
    if (notes.length === 0) return "Ничего не найдено";
    const items = notes
      .slice(0, 3)
      .map((n) => {
        const preview = (n as { preview?: unknown }).preview;
        return `«${textPreview(
          typeof preview === "string" ? preview : "",
          60,
        )}»`;
      })
      .join(", ");
    const rest = notes.length > 3 ? " …" : "";
    return `${notes.length} ${pluralNotesRu(notes.length)}: ${items}${rest}`;
  }

  /* ── Project tools ── */

  if (tool === "create_project") {
    const project = r.project as
      | { name?: unknown; origin?: unknown }
      | undefined;
    const filesCount = typeof r.filesCount === "number" ? r.filesCount : null;
    const name = typeof project?.name === "string" ? project.name : null;
    const parts: string[] = [];
    if (name) parts.push(name);
    if (filesCount !== null) {
      parts.push(`${filesCount} ${pluralFiles(filesCount)}`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  if (tool === "list_projects") {
    const projects = Array.isArray(r.projects) ? r.projects : [];
    if (projects.length === 0) return "Проектов пока нет";
    const names = projects
      .slice(0, 4)
      .map((p) => String((p as { name?: unknown }).name ?? ""))
      .filter(Boolean)
      .join(", ");
    const rest = projects.length > 4 ? " …" : "";
    return names
      ? `${projects.length} ${pluralProjectsRu(projects.length)}: ${names}${rest}`
      : null;
  }

  if (tool === "write_file" || tool === "read_file" || tool === "delete_file") {
    const path = typeof r.path === "string" ? r.path : null;
    if (!path) return null;
    const size = typeof r.size === "number" ? ` · ${formatBytes(r.size)}` : "";
    const created =
      tool === "write_file"
        ? r.created === true
          ? " · новый файл"
          : r.created === false
            ? " · обновлён"
            : ""
        : "";
    return `${path}${size}${created}`;
  }

  if (tool === "list_files") {
    const files = Array.isArray(r.files) ? r.files : [];
    const truncated = r.truncated === true ? " · показаны не все" : "";
    if (files.length === 0) return `Пусто${truncated}`;
    return `${files.length} ${pluralFiles(files.length)}${truncated}`;
  }

  if (tool === "checkpoint") {
    if (r.noop === true) return "Изменений нет";
    const commit = r.commit as { short?: unknown; message?: unknown } | null;
    const filesChanged =
      typeof r.filesChanged === "number" ? r.filesChanged : null;
    const parts: string[] = [];
    if (commit && typeof commit.short === "string") parts.push(commit.short);
    if (filesChanged !== null) {
      parts.push(`${filesChanged} ${pluralChangesRu(filesChanged)}`);
    }
    return parts.length > 0
      ? `${parts.join(" · ")}${commit && typeof commit.message === "string" ? ` — ${commit.message}` : ""}`
      : null;
  }

  return null;
}

function pluralNotesRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "заметка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "заметки";
  return "заметок";
}

function pluralProjectsRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "проект";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "проекта";
  return "проектов";
}

function pluralChangesRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "изменение";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "изменения";
  return "изменений";
}

/* ── Friendly collapsed previews for project tools ── */

function ProjectToolPreview({
  tool,
  result,
}: {
  tool: string;
  result: Record<string, unknown>;
}) {
  if (tool === "read_file") {
    const content = typeof result.content === "string" ? result.content : null;
    if (content === null) return null;
    return (
      <pre className="vf-scroll mt-1.5 max-h-40 overflow-auto rounded-lg bg-background/80 p-2 font-mono text-[10px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {content.slice(0, 500)}
        {content.length > 500 ? "\n…" : ""}
      </pre>
    );
  }
  if (tool === "list_files") {
    const files = Array.isArray(result.files) ? result.files : [];
    const paths = files
      .map((f) => (typeof f === "string" ? f : (f as { path?: unknown }).path))
      .filter((p): p is string => typeof p === "string")
      .slice(0, 30);
    if (paths.length === 0) return null;
    return (
      <ul className="vf-scroll mt-1.5 max-h-40 overflow-auto rounded-lg bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
        {paths.map((path) => (
          <li key={path} className="truncate">
            {path}
          </li>
        ))}
        {files.length > 30 && (
          <li className="text-muted-foreground/70">
            … и ещё {files.length - 30}
          </li>
        )}
      </ul>
    );
  }
  return null;
}

export const ToolCard = memo(function ToolCard({
  message,
}: {
  message: ChatMessage;
}) {
  const running = message.toolPending === true;
  const toolName = message.toolName ?? "";
  const meta = TOOL_META[toolName] ?? FALLBACK_META;
  const Icon = meta.icon;

  const args = safeParse(message.toolArgs);
  const result = running ? null : safeParse(message.toolResult);
  const resultObj =
    typeof result === "object" && result !== null
      ? (result as Record<string, unknown>)
      : null;
  const summary = running ? null : summarizeResult(toolName, result);
  const hasDetails =
    !running && ((args !== null && args !== undefined) || result !== null);
  const projectPreview =
    !running && resultObj !== null ? (
      <ProjectToolPreview tool={toolName} result={resultObj} />
    ) : null;

  return (
    <div className="flex w-full items-start gap-2.5 sm:gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground",
          running && "animate-pulse",
        )}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="flex min-w-0 max-w-[85%] flex-col items-start sm:max-w-[75%]">
        <div
          className={cn(
            "w-full rounded-xl rounded-bl-md border bg-muted/40 px-3 py-2 text-xs",
            running && "animate-pulse",
          )}
        >
          <div className="flex items-center gap-2 font-medium text-muted-foreground">
            <motion.span
              key={running ? "running" : "done"}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="flex shrink-0 items-center"
              aria-hidden="true"
            >
              {running ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className={cn("size-3.5", toolAccent(toolName))} />
              )}
            </motion.span>
            <span className="truncate">
              {running ? meta.running : meta.done}
            </span>
          </div>
          {summary && (
            <p
              className={cn(
                "mt-1.5 line-clamp-3 pl-5 leading-relaxed text-muted-foreground/90",
                toolName === "write_file" ||
                  toolName === "read_file" ||
                  toolName === "delete_file"
                  ? "font-mono break-all"
                  : "",
              )}
            >
              {summary}
            </p>
          )}
          {hasDetails && (
            <details className="pl-5">
              <summary className="mt-1 cursor-pointer select-none text-[11px] text-muted-foreground/70 transition-colors duration-150 hover:text-muted-foreground">
                подробнее
              </summary>
              {projectPreview ??
                ((): ReactNode => (
                  <pre className="vf-scroll mt-1.5 max-h-40 overflow-auto rounded-lg bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {JSON.stringify(
                      { tool: message.toolName, args, result },
                      null,
                      2,
                    )}
                  </pre>
                ))}
            </details>
          )}
        </div>
        <span className="sr-only">
          {running
            ? `Инструмент ${message.toolName ?? ""} выполняется`
            : `Инструмент ${message.toolName ?? ""} выполнен`}
        </span>
      </div>
    </div>
  );
});
