"use client";

/**
 * Левая колонка «Рукописи» — каталог библиотеки: поиск по названию
 * и тегам, фильтры по типам и избранному, чипы тегов, сортировка
 * (обновление / название / главы), группировка по коллекциям-циклам.
 * Плюс горизонтальная лента чипов — мобильный фолбэк (< lg).
 */

import { ArrowUpDown, Check, Search, Star, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DocCollectionHeader, DocListItem } from "./doc-list-item";
import {
  DOC_COLLECTIONS,
  KIND_META,
  STATUS_META,
  formatNumber,
  pluralRu,
  type DocKind,
  type StudioDoc,
} from "./types";

type DocFilter = DocKind | "all";
type DocSort = "updated" | "title" | "chapters";

const FILTERS: { id: DocFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "book", label: "Книги" },
  { id: "article", label: "Статьи" },
  { id: "script", label: "Сценарии" },
];

const SORT_ITEMS: { id: DocSort; label: string }[] = [
  { id: "updated", label: "по обновлению" },
  { id: "title", label: "по названию" },
  { id: "chapters", label: "по кол-ву глав" },
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DocFilter>("all");
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<DocSort>("updated");
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const allTags = useMemo(
    () => Array.from(new Set(docs.flatMap((doc) => doc.tags))).sort((a, b) => a.localeCompare(b, "ru")),
    [docs],
  );

  const totalWords = docs.reduce((sum, doc) => sum + doc.words, 0);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = docs.filter((doc) => {
      if (filter !== "all" && doc.kind !== filter) return false;
      if (favoritesOnly && !favorites.has(doc.id)) return false;
      if (tag && !doc.tags.includes(tag)) return false;
      if (
        normalizedQuery &&
        !doc.title.toLowerCase().includes(normalizedQuery) &&
        !doc.tags.some((t) => t.toLowerCase().includes(normalizedQuery))
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ru");
      if (sort === "chapters") return (b.chapters?.length ?? 0) - (a.chapters?.length ?? 0);
      return a.updatedAgo - b.updatedAgo;
    });
  }, [docs, query, filter, favoritesOnly, favorites, tag, sort]);

  const isCatalogued = query.trim() !== "" || filter !== "all" || favoritesOnly || tag !== null;

  const groups = useMemo(() => {
    if (isCatalogued) return null;
    const result: { id: string; label: string; hint: string; docs: StudioDoc[] }[] = DOC_COLLECTIONS.map(
      (collection) => ({
        ...collection,
        docs: visible.filter((doc) => doc.collection === collection.id),
      }),
    ).filter((group) => group.docs.length > 0);
    const rest = visible.filter((doc) => !doc.collection);
    if (rest.length > 0) {
      result.push({ id: "none", label: "Без цикла", hint: "вне коллекций", docs: rest });
    }
    return result;
  }, [visible, isCatalogued]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Каталог: поиск, фильтры, теги, сортировка */}
      <div className="shrink-0 space-y-2.5 border-b px-3 pb-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Библиотека
          </p>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {visible.length} из {docs.length}
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
            placeholder="Поиск по названию или тегу…"
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

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по типам документов">
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
          <button
            type="button"
            onClick={() => setFavoritesOnly((prev) => !prev)}
            aria-pressed={favoritesOnly}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              favoritesOnly
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/25 hover:bg-accent",
            )}
          >
            <Star className={cn("size-3", favoritesOnly && "fill-primary")} aria-hidden="true" />
            Избранные
            <span className={cn("tabular-nums", favoritesOnly ? "text-primary/70" : "text-muted-foreground/70")}>
              {favorites.size}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Фильтр по тегам">
          {allTags.map((t) => {
            const active = tag === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTag(active ? null : t)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  active
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground/80 hover:border-foreground/25 hover:text-foreground",
                )}
              >
                #{t}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-0.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
                <ArrowUpDown className="size-3" aria-hidden="true" />
                {SORT_ITEMS.find((item) => item.id === sort)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {SORT_ITEMS.map((item) => (
                <DropdownMenuItem key={item.id} onClick={() => setSort(item.id)}>
                  <span className="flex w-full items-center justify-between">
                    {item.label}
                    {sort === item.id ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : null}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-[11px] leading-none text-muted-foreground">
            {isCatalogued ? "плоский список" : "по циклам"}
          </p>
        </div>
      </div>

      {/* Список: группы-коллекции или плоский результат фильтрации */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-muted-foreground">
            {favoritesOnly
              ? "Отметьте документы звёздочкой — они появятся здесь"
              : "Ничего не найдено — попробуйте другой запрос"}
          </p>
        ) : groups ? (
          groups.map((group) => (
            <section key={group.id} aria-label={group.label} className="mb-2">
              <ul>
                <DocCollectionHeader label={group.label} hint={group.hint} count={group.docs.length} />
                {group.docs.map((doc) => (
                  <DocListItem
                    key={doc.id}
                    doc={doc}
                    active={doc.id === activeId}
                    favorite={favorites.has(doc.id)}
                    onSelect={onSelect}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <ul>
            {visible.map((doc) => (
              <DocListItem
                key={doc.id}
                doc={doc}
                active={doc.id === activeId}
                favorite={favorites.has(doc.id)}
                onSelect={onSelect}
                onToggleFavorite={toggleFavorite}
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
            {docs.length} {pluralRu(docs.length, "документ", "документа", "документов")}
          </span>{" "}
          · {formatNumber(totalWords)} {pluralRu(totalWords, "слово", "слова", "слов")}
        </p>
      </div>
    </div>
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
