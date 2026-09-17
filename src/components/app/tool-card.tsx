"use client";

/**
 * ToolCard — compact system card for role:"tool" chat rows (agent tool calls).
 * Running state: spinner + pulse. Done: subtle emerald check + readable
 * result summary. Raw args/result JSON stays behind a «подробнее» toggle.
 * Deliberately muted so it never reads as user/assistant text.
 */

import { memo } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Eye,
  List,
  Loader2,
  NotebookPen,
  Search,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { ChatMessage } from "@/lib/types";
import { pluralNotes, textPreview } from "@/lib/format";
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
    return `${notes.length} ${pluralNotes(notes.length)}: ${items}${rest}`;
  }

  return null;
}

export const ToolCard = memo(function ToolCard({
  message,
}: {
  message: ChatMessage;
}) {
  const running = message.toolPending === true;
  const meta = TOOL_META[message.toolName ?? ""] ?? FALLBACK_META;
  const Icon = meta.icon;

  const args = safeParse(message.toolArgs);
  const result = running ? null : safeParse(message.toolResult);
  const summary = running ? null : summarizeResult(message.toolName ?? "", result);
  const hasDetails =
    !running && ((args !== null && args !== undefined) || result !== null);

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
                <Check className="size-3.5 text-primary" />
              )}
            </motion.span>
            <span className="truncate">
              {running ? meta.running : meta.done}
            </span>
          </div>
          {summary && (
            <p className="mt-1.5 line-clamp-3 pl-5 leading-relaxed text-muted-foreground/90">
              {summary}
            </p>
          )}
          {hasDetails && (
            <details className="pl-5">
              <summary className="mt-1 cursor-pointer select-none text-[11px] text-muted-foreground/70 transition-colors duration-150 hover:text-muted-foreground">
                подробнее
              </summary>
              <pre className="vf-scroll mt-1.5 max-h-40 overflow-auto rounded-lg bg-background/80 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                {JSON.stringify(
                  { tool: message.toolName, args, result },
                  null,
                  2,
                )}
              </pre>
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
