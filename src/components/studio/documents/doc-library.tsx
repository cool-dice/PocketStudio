"use client";

/**
 * Левая колонка «Рукописи»: каталог документов из API. Поиск по названию,
 * чипы типов со счётчиками, сортировка. В глобальном режиме список
 * группируется «полками» воркспейсов. Плюс горизонтальная лента чипов —
 * мобильный фолбэк (< lg).
 */

import { ArrowUpDown, Check, RotateCcw, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DocumentDto, DocumentKind } from "@/lib/workspace-types";
import { DocListItem, ShelfHeader } from "./doc-list-item";
import { DOCUMENTS_LOAD_ERROR, DOCUMENTS_RETRY } from "@/lib/documents-list";
import { DOC_KIND_FILTERS, docKindMeta, formatNumber, pluralRu } from "./types";

type DocFilter = DocumentKind | "all";
type DocSort = "updated" | "title" | "words";

const SORT_ITEMS: { id: DocSort; label: string }[] = [
  { id: "updated", label: "по обновлению" },
  { id: "title", label: "по названию" },
  { id: "words", label: "по кол-ву слов" },
];

function sortDocs(docs: DocumentDto[], sort: DocSort): DocumentDto[] {
  return [...docs].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title, "ru");
    if (sort === "words") return b.wordsCount - a.wordsCount;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function DocumentLibrary({
  docs,
  shelves,
  activeId,
  onSelect,
  onRemove,
  loading,
  loadError,
  onRetry,
}: {
  /** Режим одного воркспейса: плоский список. */
  docs?: DocumentDto[];
  /** Глобальный режим: документы, сгруппированные по воркспейсам. */
  shelves?: DocShelf[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
  loading?: boolean;
  loadError?: boolean;
  onRetry?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DocFilter>("all");
  const [sort, setSort] = useState<DocSort>("updated");

  const allDocs = useMemo(
    () => docs ?? shelves?.flatMap((shelf) => shelf.documents) ?? [],
    [docs, shelves],
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return allDocs.filter((doc) => {
      if (filter !== "all" && doc.kind !== filter) return false;
      if (normalized && !doc.title.toLowerCase().includes(normalized)) return false;
      return true;
    });
  }, [allDocs, query, filter]);

  const shelfGroups = useMemo(
    () =>
      shelves
        ?.map((shelf) => ({
          shelf,
          docs: sortDocs(
            shelf.documents.filter((doc) => visible.some((v) => v.id === doc.id)),
            sort,
          ),
        }))
        .filter((group) => group.docs.length > 0),
    [shelves, visible, sort],
  );

  const totalWords = allDocs.reduce((sum, doc) => sum + doc.wordsCount, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Каталог: поиск, фильтры, сортировка */}
      <div className="shrink-0 space-y-2.5 border-b px-3 pb-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Библиотека
          </p>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {visible.length} из {allDocs.length}
          </p>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию…"
            aria-label="Поиск по документам"
            className="h-8 pl-8 pr-8 text-xs"
          />
          {query !== "" ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Фильтр по типам документов"
        >
          <FilterChip
            label="Все"
            active={filter === "all"}
            count={allDocs.length}
            onClick={() => setFilter("all")}
          />
          {DOC_KIND_FILTERS.map((kind) => {
            const count = allDocs.filter((doc) => doc.kind === kind).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={kind}
                label={docKindMeta(kind).plural}
                active={filter === kind}
                count={count}
                onClick={() => setFilter(kind)}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
              >
                <ArrowUpDown className="size-3" aria-hidden="true" />
                {SORT_ITEMS.find((item) => item.id === sort)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {SORT_ITEMS.map((item) => (
                <DropdownMenuItem key={item.id} onClick={() => setSort(item.id)}>
                  <span className="flex w-full items-center justify-between">
                    {item.label}
                    {sort === item.id ? (
                      <Check className="size-3.5 text-primary" aria-hidden="true" />
                    ) : null}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[11px] leading-none text-muted-foreground">
            {shelves ? "по воркспейсам" : "этот воркспейс"}
          </p>
        </div>
      </div>

      {/* Список: полки или плоский список */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-3 py-8 text-center">
            <p className="text-xs text-muted-foreground">{DOCUMENTS_LOAD_ERROR}</p>
            {onRetry ? (
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                <RotateCcw className="size-3.5" aria-hidden="true" />
                {DOCUMENTS_RETRY}
              </Button>
            ) : null}
          </div>
        ) : visible.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {query.trim() !== "" || filter !== "all"
              ? "Ничего не найдено — попробуйте другой запрос"
              : "Документов пока нет — создайте первый"}
          </p>
        ) : shelfGroups ? (
          shelfGroups.map((group) => (
            <section key={group.shelf.workspace.id} aria-label={group.shelf.workspace.name} className="mb-2">
              <ul>
                <ShelfHeader
                  type={group.shelf.workspace.type}
                  label={group.shelf.workspace.name}
                  count={group.docs.length}
                />
                {group.docs.map((doc) => (
                  <DocListItem
                    key={doc.id}
                    doc={doc}
                    active={doc.id === activeId}
                    onSelect={onSelect}
                    onRemove={onRemove}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <ul>
            {sortDocs(visible, sort).map((doc) => (
              <DocListItem
                key={doc.id}
                doc={doc}
                active={doc.id === activeId}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Мини-итог */}
      <div className="shrink-0 border-t px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Итого:{" "}
          <span className="font-semibold text-foreground">
            {allDocs.length} {pluralRu(allDocs.length, "документ", "документа", "документов")}
          </span>{" "}
          · {formatNumber(totalWords)} {pluralRu(totalWords, "слово", "слова", "слов")}
        </p>
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  count,
  onClick,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/25 hover:bg-accent",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active ? "text-primary/70" : "text-muted-foreground/70")}>
        {count}
      </span>
    </button>
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
  docs: DocumentDto[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Выбор документа"
      className="vf-scroll-x shrink-0 border-b bg-muted/30 px-3 py-2.5 lg:hidden"
    >
      <ul className="flex items-center gap-2">
        {docs.map((doc) => {
          const kind = docKindMeta(doc.kind);
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
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
