"use client";

/**
 * Левая колонка «Документы»: фильтры по типам, список документов
 * с прогрессом и статусами, мини-итог внизу. Плюс горизонтальная
 * лента чипов — мобильный фолбэк на месте скрытой колонки (< lg).
 */

import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  KIND_META,
  STATUS_META,
  formatNumber,
  pluralRu,
  type DocKind,
  type StudioDoc,
} from "./types";

type DocFilter = DocKind | "all";

const FILTERS: { id: DocFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "book", label: "Книги" },
  { id: "article", label: "Статьи" },
  { id: "script", label: "Сценарии" },
];

export function DocumentLibrary({
  docs,
  activeId,
  onSelect,
}: {
  docs: StudioDoc[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<DocFilter>("all");
  const visible = filter === "all" ? docs : docs.filter((doc) => doc.kind === filter);
  const totalWords = docs.reduce((sum, doc) => sum + doc.words, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Фильтры по типам */}
      <div className="shrink-0 border-b px-3 pb-3 pt-4">
        <p className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Библиотека
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по типам документов">
          {FILTERS.map((f) => {
            const count = f.id === "all" ? docs.length : docs.filter((doc) => doc.kind === f.id).length;
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/25 hover:bg-accent",
                )}
              >
                {f.label}
                <span className={cn("tabular-nums", active ? "text-primary/70" : "text-muted-foreground/70")}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Список документов */}
      <ul className="vf-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <li className="px-3 py-8 text-center text-xs text-muted-foreground">
            В этой категории пока пусто
          </li>
        ) : (
          visible.map((doc) => (
            <DocListItem key={doc.id} doc={doc} active={doc.id === activeId} onSelect={onSelect} />
          ))
        )}
      </ul>

      {/* Мини-итог */}
      <div className="shrink-0 border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Итого:{" "}
          <span className="font-semibold text-foreground">
            {docs.length} {pluralRu(docs.length, "документ", "документа", "документов")}
          </span>{" "}
          · {formatNumber(totalWords)} {pluralRu(totalWords, "слово", "слова", "слов")}
        </p>
      </div>
    </div>
  );
}

function DocListItem({
  doc,
  active,
  onSelect,
}: {
  doc: StudioDoc;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const kind = KIND_META[doc.kind];
  const status = STATUS_META[doc.status];
  const Icon = kind.icon;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(doc.id)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "w-full rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-colors hover:bg-accent",
          active && "border-border bg-accent shadow-xs",
        )}
      >
        <span className="flex items-start gap-2.5">
          <span
            className={cn(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background transition-colors",
              active ? "border-primary/30 text-primary" : "text-muted-foreground",
            )}
            aria-hidden="true"
          >
            <Icon className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm", active ? "font-semibold" : "font-medium")}>
              {doc.title}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {formatNumber(doc.words)} {pluralRu(doc.words, "слово", "слова", "слов")}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-medium",
                  status.className,
                )}
              >
                {status.label}
              </span>
            </span>
            <span
              className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={doc.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Готовность «${doc.title}» — ${doc.progress}%`}
            >
              <span className="block h-full rounded-full bg-primary transition-[width]" style={{ width: `${doc.progress}%` }} />
            </span>
            <span className="mt-1 block text-[10px] tabular-nums text-muted-foreground">
              {doc.kind === "book" && doc.chapters
                ? `${doc.chapters.length} ${pluralRu(doc.chapters.length, "глава", "главы", "глав")} · `
                : ""}
              {doc.progress}%
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Мобильная лента документов (видна на < lg вместо скрытой колонки).
 */
export function DocChipsBar({
  docs,
  activeId,
  onSelect,
}: {
  docs: StudioDoc[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Выбор документа"
      className="vf-scroll-x shrink-0 border-b bg-muted/30 px-3 py-2.5 lg:hidden"
    >
      <ul className="flex items-center gap-2">
        {docs.map((doc) => {
          const kind = KIND_META[doc.kind];
          const status = STATUS_META[doc.status];
          const Icon = kind.icon;
          const active = doc.id === activeId;
          return (
            <li key={doc.id}>
              <button
                type="button"
                onClick={() => onSelect(doc.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex max-w-56 shrink-0 items-center gap-2 rounded-full border py-1.5 pl-2.5 pr-3 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{doc.title}</span>
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", status.dotClassName)}
                  aria-hidden="true"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
