"use client";

/**
 * Вкладка «Структура»: разделы документа из API. «+ Глава» открывает
 * диалог названия → createSection; у каждой главы меню (…) — переимено-
 * вать, переключить статус черновик/готово, удалить (с подтверждением).
 */

import { Check, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";
import type { DocumentDto, DocumentSectionDto } from "@/lib/workspace-types";
import { formatNumber, pluralRu } from "./types";

type TitleDialog =
  | { mode: "create" }
  | { mode: "rename"; section: DocumentSectionDto }
  | null;

export function ChapterTree({
  doc,
  currentId,
  onSelect,
  onCreateSection,
  onRenameSection,
  onToggleStatus,
  onDeleteSection,
}: {
  doc: DocumentDto;
  currentId: string | null;
  onSelect: (id: string) => void;
  onCreateSection: (title: string) => Promise<DocumentSectionDto>;
  onRenameSection: (id: string, title: string) => void;
  onToggleStatus: (section: DocumentSectionDto) => void;
  onDeleteSection: (id: string) => void;
}) {
  const sections = doc.sections ?? [];
  const doneCount = sections.filter((section) => section.status === "done").length;
  const progress =
    sections.length > 0 ? Math.round((doneCount / sections.length) * 100) : 0;

  const [dialog, setDialog] = useState<TitleDialog>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openCreate() {
    setTitle("");
    setDialog({ mode: "create" });
  }

  async function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      if (dialog?.mode === "rename") {
        onRenameSection(dialog.section.id, trimmed);
      } else {
        const section = await onCreateSection(trimmed);
        onSelect(section.id);
      }
      setDialog(null);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось создать главу",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Содержание
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openCreate}
            className="h-7 gap-1 px-2 text-xs text-primary"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Глава
          </Button>
        </div>
        <p className="mt-1.5 truncate text-sm font-semibold">{doc.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatNumber(sections.length)}{" "}
          {pluralRu(sections.length, "раздел", "раздела", "разделов")} ·{" "}
          {formatNumber(doneCount)}{" "}
          {pluralRu(doneCount, "готов", "готово", "готово")}
        </p>
        <div
          className="mt-3 block h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Готовность документа — ${progress}%`}
        >
          <div className="block h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ul className="vf-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {sections.map((section, index) => (
          <ChapterTreeItem
            key={section.id}
            section={section}
            index={index}
            current={section.id === currentId}
            onSelect={onSelect}
            onRename={() => {
              setTitle(section.title);
              setDialog({ mode: "rename", section });
            }}
            onToggleStatus={() => onToggleStatus(section)}
            onDelete={() => setDeleteId(section.id)}
          />
        ))}
      </ul>

      {/* Диалог названия: новая глава или переименование */}
      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === "rename" ? "Переименовать раздел" : "Новая глава"}
            </DialogTitle>
            <DialogDescription>
              {dialog?.mode === "rename"
                ? "Название появится в дереве структуры сразу после сохранения."
                : "Глава добавится в конец документа — начните писать в редакторе."}
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Глава 4. Дозор на мосту"
            aria-label="Название раздела"
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSubmit();
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialog(null)}>
              Отмена
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!title.trim() || busy}>
              {dialog?.mode === "rename" ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение удаления */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Удалить раздел?</DialogTitle>
            <DialogDescription>
              Раздел и его текст будут удалены безвозвратно. Действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)}>
              Оставить
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteId) onDeleteSection(deleteId);
                setDeleteId(null);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChapterTreeItem({
  section,
  index,
  current,
  onSelect,
  onRename,
  onToggleStatus,
  onDelete,
}: {
  section: DocumentSectionDto;
  index: number;
  current: boolean;
  onSelect: (id: string) => void;
  onRename: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  return (
    <li>
      <div
        className={cn(
          "flex items-start gap-1 rounded-lg border border-transparent transition-colors",
          current ? "border-border bg-accent shadow-xs" : "hover:bg-accent",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(section.id)}
          aria-current={current ? "true" : undefined}
          className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg px-2.5 py-2 text-left"
        >
          <StatusIcon status={section.status} />
          <span className="min-w-0 flex-1">
            <span
              className={cn(
                "block truncate text-sm",
                current
                  ? "font-medium text-foreground"
                  : section.status === "done"
                    ? "text-foreground/70"
                    : "text-muted-foreground",
              )}
            >
              {formatNumber(index + 1)}. {section.title}
            </span>
            {current ? (
              <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                {formatNumber(section.wordsCount)}{" "}
                {pluralRu(section.wordsCount, "слово", "слова", "слов")} ·{" "}
                {section.status === "done" ? "готово" : "черновик"}
              </span>
            ) : null}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Действия с разделом «${section.title}»`}
              className="mr-0.5 mt-0.5 size-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="size-3.5" aria-hidden="true" />
              Переименовать
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleStatus}>
              <Check className="size-3.5" aria-hidden="true" />
              {section.status === "done" ? "Вернуть в черновики" : "Пометить готовой"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="size-3.5" aria-hidden="true" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

function StatusIcon({ status }: { status: "draft" | "done" }) {
  if (status === "done") {
    return (
      <span
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden="true"
        title="Раздел готов"
      >
        <Check className="size-3" />
      </span>
    );
  }
  return (
    <span
      className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      aria-hidden="true"
      title="Черновик"
    >
      <Pencil className="size-3" />
    </span>
  );
}
