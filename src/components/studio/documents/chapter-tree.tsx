"use client";

/**
 * Вкладка «Структура»: дерево глав книги с состояниями
 * (готово / пишется / впереди) и пустое состояние для документов без глав.
 */

import { Check, Circle, Layers, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNumber, pluralRu, type Chapter, type ChapterStatus, type StudioDoc } from "./types";

export function ChapterTree({
  doc,
  currentId,
  onSelect,
}: {
  doc: StudioDoc;
  currentId: string | null;
  onSelect: (id: string) => void;
}) {
  const chapters = doc.chapters ?? [];
  const doneCount = chapters.filter((chapter) => chapter.status === "done").length;
  const writingCount = chapters.filter((chapter) => chapter.status === "current").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pb-3 pt-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Содержание</p>
        <p className="mt-1.5 truncate text-sm font-semibold">{doc.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatNumber(chapters.length)} {pluralRu(chapters.length, "глава", "главы", "глав")} ·{" "}
          {formatNumber(doneCount)} {pluralRu(doneCount, "написана", "написаны", "написано")}
          {writingCount > 0 ? ` · ${formatNumber(writingCount)} пишется` : ""}
        </p>
        <div
          className="mt-3 block h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={doc.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Готовность книги — ${doc.progress}%`}
        >
          <div className="block h-full rounded-full bg-primary" style={{ width: `${doc.progress}%` }} />
        </div>
      </div>

      <ul className="vf-scroll min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {chapters.map((chapter) => (
          <ChapterTreeItem
            key={chapter.id}
            chapter={chapter}
            current={chapter.id === currentId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

function ChapterTreeItem({
  chapter,
  current,
  onSelect,
}: {
  chapter: Chapter;
  current: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(chapter.id)}
        aria-current={current ? "true" : undefined}
        className={cn(
          "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent",
          current && "bg-accent",
        )}
      >
        <ChapterStatusIcon status={chapter.status} />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm",
              current
                ? "font-medium text-foreground"
                : chapter.status === "done"
                  ? "text-foreground/70"
                  : "text-muted-foreground",
            )}
          >
            {formatNumber(chapter.number)}. {chapter.title}
          </span>
          {current && chapter.words > 0 ? (
            <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
              {formatNumber(chapter.words)} {pluralRu(chapter.words, "слово", "слова", "слов")} · пишется
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

function ChapterStatusIcon({ status }: { status: ChapterStatus }) {
  if (status === "done") {
    return (
      <span
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        aria-hidden="true"
        title="Глава написана"
      >
        <Check className="size-3" />
      </span>
    );
  }
  if (status === "current") {
    return (
      <span
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
        title="Глава в работе"
      >
        <Pencil className="size-3" />
      </span>
    );
  }
  return (
    <span className="mt-1 flex size-5 shrink-0 items-center justify-center text-muted-foreground/50" aria-hidden="true" title="Глава не начата">
      <Circle className="size-3.5" />
    </span>
  );
}

/** Структура для документов без глав: статьи и сценарии. */
export function ChapterTreeEmpty({ doc }: { doc: StudioDoc }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <span
        className="flex size-11 items-center justify-center rounded-xl border bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Layers className="size-5" />
      </span>
      <div>
        <p className="text-sm font-medium">Структуры пока нет</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {doc.kind === "script"
            ? "Сценарий редактируется целиком — разбивка на сцены появится вместе с ИИ-помощником."
            : "Разбейте документ на разделы, чтобы видеть план, прогресс и порядок работы."}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-1">
        <Plus className="size-3.5" aria-hidden="true" />
        Добавить раздел
      </Button>
    </div>
  );
}
