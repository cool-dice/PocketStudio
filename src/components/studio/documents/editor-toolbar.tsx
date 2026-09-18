"use client";

/**
 * Клейкая панель над текстом главы: инструменты разметки работают
 * по выделению в textarea (setRangeText), undo/redo — нативные.
 * Справа — малозаметный индикатор автосохранения («Сохраняем…» /
 * «Сохранено · 12:41») и переключатель статуса главы.
 */

import {
  Bold,
  Check,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Loader2,
  PenLine,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SectionStatus } from "./types";

export type SaveState = "idle" | "dirty" | "saving" | "saved";

/** Обёртка выделения парными маркерами (**…**, *…*). */
function wrapSelection(el: HTMLTextAreaElement, before: string, after: string): void {
  const { selectionStart, selectionEnd } = el;
  const selected = el.value.slice(selectionStart, selectionEnd);
  el.focus();
  el.setRangeText(`${before}${selected}${after}`, selectionStart, selectionEnd, "end");
}

/** Префикс строки, где начинается выделение (# / - / >). */
function prefixLine(el: HTMLTextAreaElement, prefix: string): void {
  const { selectionStart } = el;
  const lineStart = el.value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  el.focus();
  if (el.value.slice(lineStart, lineStart + prefix.length) === prefix) {
    // Префикс уже стоит — снимаем.
    el.setRangeText("", lineStart, lineStart + prefix.length, "preserve");
    return;
  }
  el.setRangeText(prefix, lineStart, lineStart, "preserve");
}

export function EditorToolbar({
  textareaRef,
  onValueChange,
  saveState,
  savedLabel,
  sectionStatus,
  onToggleStatus,
  disabled,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** Сообщает React о новом значении после setRangeText. */
  onValueChange: (value: string) => void;
  saveState: SaveState;
  savedLabel: string;
  sectionStatus: SectionStatus | null;
  onToggleStatus: () => void;
  disabled: boolean;
}) {
  function run(action: () => void) {
    if (disabled) return;
    action();
    onValueChange(textareaRef.current?.value ?? "");
  }

  return (
    <div className="sticky top-0 z-10 border-y bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
      <div className="mx-auto flex max-w-3xl items-center gap-0.5 px-3 py-1.5 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Полужирный (Ctrl+B)"
          aria-label="Полужирный"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => run(() => wrapSelection(textareaRef.current!, "**", "**"))}
        >
          <Bold className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Курсив (Ctrl+I)"
          aria-label="Курсив"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => run(() => wrapSelection(textareaRef.current!, "*", "*"))}
        >
          <Italic className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Подзаголовок H2"
          aria-label="Подзаголовок"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => run(() => prefixLine(textareaRef.current!, "## "))}
        >
          <Heading2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Маркированный список"
          aria-label="Список"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => run(() => prefixLine(textareaRef.current!, "- "))}
        >
          <List className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Цитата"
          aria-label="Цитата"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => run(() => prefixLine(textareaRef.current!, "> "))}
        >
          <Quote className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Ссылка (Ctrl+K)"
          aria-label="Ссылка"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => run(() => wrapSelection(textareaRef.current!, "[", "](…)"))}
        >
          <Link2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Изображение — вставьте ссылку"
          aria-label="Изображение"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => run(() => wrapSelection(textareaRef.current!, "![", "](…)"))}
        >
          <ImageIcon className="size-4" aria-hidden="true" />
        </Button>

        <span className="mx-1.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Отменить (Ctrl+Z)"
          aria-label="Отменить"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            document.execCommand("undo");
            onValueChange(el.value);
          }}
        >
          <Undo2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Повторить (Ctrl+Shift+Z)"
          aria-label="Повторить"
          disabled={disabled}
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            document.execCommand("redo");
            onValueChange(el.value);
          }}
        >
          <Redo2 className="size-4" aria-hidden="true" />
        </Button>

        {/* Статус главы */}
        {sectionStatus ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onToggleStatus}
            title="Переключить статус главы"
            className={cn(
              "ml-1 h-7 gap-1.5 rounded-full border px-2.5 text-[11px] font-medium",
              sectionStatus === "done"
                ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 hover:text-emerald-700 dark:text-emerald-400"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:text-amber-700 dark:text-amber-400",
            )}
          >
            <PenLine className="size-3" aria-hidden="true" />
            {sectionStatus === "done" ? "Готово" : "Черновик"}
          </Button>
        ) : null}

        {/* Индикатор автосохранения */}
        <span
          className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
          title="Автосохранение включено"
          aria-live="polite"
        >
          {saveState === "saving" || saveState === "dirty" ? (
            <>
              <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
              <span className="hidden min-[420px]:inline">Сохраняем…</span>
            </>
          ) : (
            <>
              <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="hidden min-[420px]:inline">{savedLabel}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
