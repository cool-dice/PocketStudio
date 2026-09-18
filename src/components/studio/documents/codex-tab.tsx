"use client";

/**
 * Вкладка «Кодекс»: каталог лора мира. Фильтры по категориям
 * со счётчиками, поиск, сортировка; карточки сущностей со связями
 * и упоминаниями в главах; детальная панель-Sheet с мок-генерацией
 * описания.
 */

import { ArrowUpDown, Check, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CodexEntitySheet } from "./codex-entity-sheet";
import { MiniChip, SelectableChip } from "./narrative-chip";
import {
  GENERATED_LORE_TEMPLATES,
  LORE_CATEGORY_META,
  LORE_ENTITIES,
  agoLabel,
  getLoreEntity,
  type LoreCategory,
  type LoreEntity,
} from "./narrative-data";

type CodexSort = "title" | "updated";

const SORT_ITEMS: { id: CodexSort; label: string }[] = [
  { id: "title", label: "по названию" },
  { id: "updated", label: "по обновлению" },
];

const CATEGORY_FILTERS: { id: LoreCategory | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "location", label: "Локации" },
  { id: "event", label: "События" },
  { id: "item", label: "Предметы" },
  { id: "faction", label: "Фракции" },
  { id: "rule", label: "Правила мира" },
];

export function CodexTab() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LoreCategory | "all">("all");
  const [sort, setSort] = useState<CodexSort>("updated");
  const [openId, setOpenId] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = LORE_ENTITIES.filter((entity) => {
      if (category !== "all" && entity.category !== category) return false;
      if (
        normalizedQuery &&
        !entity.name.toLowerCase().includes(normalizedQuery) &&
        !entity.short.toLowerCase().includes(normalizedQuery) &&
        !entity.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) =>
      sort === "title" ? a.name.localeCompare(b.name, "ru") : a.updatedAgo - b.updatedAgo,
    );
  }, [query, category, sort]);

  function handleGenerate(entity: LoreEntity) {
    if (generatingId !== null) return;
    setGeneratingId(entity.id);
    timerRef.current = window.setTimeout(() => {
      setGenerated((prev) => ({ ...prev, [entity.id]: GENERATED_LORE_TEMPLATES[entity.category] }));
      setGeneratingId(null);
      toast.success("Описание сгенерировано", {
        description: `Черновик абзаца добавлен в карточку «${entity.name}».`,
      });
    }, 1500);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Каталогизация: фильтры, поиск, сортировка */}
      <div className="shrink-0 space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold">Кодекс мира</h3>
            <p className="text-xs text-muted-foreground">
              {LORE_ENTITIES.length} записей для «Хроник Долгой Зимы»
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <ArrowUpDown className="size-3" aria-hidden="true" />
                  {SORT_ITEMS.find((item) => item.id === sort)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() =>
                toast.info("Конструктор записей", {
                  description: "Создание записей кодекса подключается на следующем этапе.",
                })
              }
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Запись
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по кодексу…"
              aria-label="Поиск по сущностям кодекса"
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
            className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0"
            role="group"
            aria-label="Фильтр по категориям"
          >
            {CATEGORY_FILTERS.map((filter) => (
              <SelectableChip
                key={filter.id}
                label={filter.label}
                selected={category === filter.id}
                onClick={() => setCategory(filter.id)}
                count={
                  filter.id === "all"
                    ? LORE_ENTITIES.length
                    : LORE_ENTITIES.filter((entity) => entity.category === filter.id).length
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* Сетка карточек сущностей */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">В кодексе ничего не нашлось</p>
            <p className="text-xs text-muted-foreground">
              Попробуйте другую категорию или очистите поиск.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((entity) => (
              <CodexEntityCard
                key={entity.id}
                entity={entity}
                hasGenerated={Boolean(generated[entity.id])}
                onOpen={() => setOpenId(entity.id)}
                onOpenRelated={(id) => setOpenId(id)}
              />
            ))}
          </div>
        )}
      </div>

      <CodexEntitySheet
        entityId={openId}
        onClose={() => setOpenId(null)}
        onOpenEntity={(id) => setOpenId(id)}
        generated={generated}
        generatingId={generatingId}
        onGenerate={handleGenerate}
      />
    </div>
  );
}

function CodexEntityCard({
  entity,
  hasGenerated,
  onOpen,
  onOpenRelated,
}: {
  entity: LoreEntity;
  hasGenerated: boolean;
  onOpen: () => void;
  onOpenRelated: (id: string) => void;
}) {
  const meta = LORE_CATEGORY_META[entity.category];
  const Icon = meta.icon;

  return (
    <article className="group flex flex-col rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-sm">
      <button type="button" onClick={onOpen} className="flex-1 text-left">
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
            <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {meta.label}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70">
              {agoLabel(entity.updatedAgo)}
            </span>
          </div>
          <h4 className="mt-2.5 font-serif text-base font-semibold leading-tight">
            {entity.name}
          </h4>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {entity.short}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {entity.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/80">упомянута в:</span>
            {entity.chapters.map((chapter) => (
              <span
                key={chapter}
                className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary"
              >
                гл. {chapter}
              </span>
            ))}
            {hasGenerated ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                +ИИ
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <div className="mt-auto border-t px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/80">связи:</span>
          {entity.related.map((relatedId) => {
            const related = getLoreEntity(relatedId);
            if (!related) return null;
            return (
              <MiniChip
                key={relatedId}
                onClick={() => onOpenRelated(relatedId)}
                title={`Открыть «${related.name}»`}
                className="max-w-36"
              >
                <span className="truncate">{related.name}</span>
              </MiniChip>
            );
          })}
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              "ml-auto text-[11px] font-medium text-primary opacity-70 transition-opacity",
              "hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            Открыть →
          </button>
        </div>
      </div>
    </article>
  );
}
