"use client";

/**
 * Вкладка «Альбом»: галерея сгенерированных портретов и иллюстраций,
 * привязанных к сущностям романа. Фильтры по типу и сущности,
 * поиск, сортировка; лайтбокс-диалог с мок-генерацией вариации
 * и переходом к персонажу.
 */

import { ArrowUpDown, Check, ImageIcon, Search, Sparkles, User, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { GradientArt } from "./art-placeholder";
import { WipBadge } from "./codex-entity-sheet";
import { SelectableChip } from "./narrative-chip";
import { agoLabel } from "./narrative-data";
import {
  ALBUM_KIND_META,
  type AlbumItem,
  type AlbumItemKind,
} from "./album-data";

type AlbumSort = "date" | "title";

const SORT_ITEMS: { id: AlbumSort; label: string }[] = [
  { id: "date", label: "по дате" },
  { id: "title", label: "по названию" },
];

const TYPE_FILTERS: { id: AlbumItemKind | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "portrait", label: "Портреты" },
  { id: "illustration", label: "Иллюстрации" },
  { id: "concept", label: "Концепты" },
];

export function AlbumTab({
  items,
  generatingVariationId,
  onGenerateVariation,
  onOpenCharacter,
}: {
  items: AlbumItem[];
  generatingVariationId: string | null;
  onGenerateVariation: (item: AlbumItem) => void;
  onOpenCharacter: (characterId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AlbumItemKind | "all">("all");
  const [entity, setEntity] = useState<string | null>(null);
  const [sort, setSort] = useState<AlbumSort>("date");
  const [openId, setOpenId] = useState<string | null>(null);

  const entities = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.entityId, (counts.get(item.entityId) ?? 0) + 1));
    return Array.from(counts.entries()).map(([id, count]) => ({
      id,
      name: items.find((item) => item.entityId === id)?.entityName ?? id,
      count,
    }));
  }, [items]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (type !== "all" && item.kind !== type) return false;
      if (entity && item.entityId !== entity) return false;
      if (
        normalizedQuery &&
        !item.title.toLowerCase().includes(normalizedQuery) &&
        !item.entityName.toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) =>
      sort === "title" ? a.title.localeCompare(b.title, "ru") : a.createdAtAgo - b.createdAtAgo,
    );
  }, [items, query, type, entity, sort]);

  const openItem = items.find((item) => item.id === openId) ?? null;
  const isGeneratingVariation = openItem ? generatingVariationId === openItem.id : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Каталогизация */}
      <div className="shrink-0 space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold">Альбом</h3>
            <p className="text-xs text-muted-foreground">
              {items.length} работ · привязаны к сущностям романа
            </p>
          </div>
          <div className="ml-auto">
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
              placeholder="Поиск по названию или сущности…"
              aria-label="Поиск по альбому"
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
            aria-label="Фильтр по типу работы"
          >
            {TYPE_FILTERS.map((filter) => (
              <SelectableChip
                key={filter.id}
                label={filter.label}
                selected={type === filter.id}
                onClick={() => setType(filter.id)}
                count={
                  filter.id === "all"
                    ? items.length
                    : items.filter((item) => item.kind === filter.id).length
                }
              />
            ))}
          </div>
        </div>

        <div
          className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5"
          role="group"
          aria-label="Фильтр по сущности"
        >
          <span className="shrink-0 text-[11px] text-muted-foreground/70">сущности:</span>
          <SelectableChip
            label="все"
            selected={entity === null}
            onClick={() => setEntity(null)}
          />
          {entities.map((entityItem) => (
            <SelectableChip
              key={entityItem.id}
              label={entityItem.name}
              selected={entity === entityItem.id}
              onClick={() => setEntity(entityItem.id)}
              count={entityItem.count}
            />
          ))}
        </div>
      </div>

      {/* Сетка тайлов */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">В альбоме ничего не нашлось</p>
            <p className="text-xs text-muted-foreground">
              Сгенерируйте портрет из карточки персонажа — он появится здесь.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((item) => (
              <AlbumTile key={item.id} item={item} onOpen={() => setOpenId(item.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Лайтбокс */}
      <Dialog open={Boolean(openItem)} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-w-2xl gap-0 p-0 sm:rounded-xl">
          {openItem ? (
            <>
              <GradientArt
                gradient={openItem.gradient}
                ariaLabel={`Заглушка работы: ${openItem.title}`}
                className="aspect-[16/9] w-full rounded-t-xl border-b sm:rounded-t-xl"
                iconClassName="size-16"
              />
              <div className="space-y-3 p-5">
                <DialogHeader className="space-y-1.5 text-left">
                  <DialogTitle className="font-serif text-lg leading-tight">
                    {openItem.title}
                  </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {ALBUM_KIND_META[openItem.kind].label}
                    </span>
                    <span className="text-xs">
                      Сущность: <span className="font-medium text-foreground/80">{openItem.entityName}</span>
                    </span>
                    <span className="text-xs">{agoLabel(openItem.createdAtAgo)}</span>
                    {openItem.isGenerated ? (
                      <span className="text-[11px] font-medium text-primary">сгенерировано сейчас</span>
                    ) : null}
                  </DialogDescription>
                </DialogHeader>

                <p className="text-sm leading-relaxed text-muted-foreground">{openItem.description}</p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    disabled={isGeneratingVariation}
                    onClick={() => onGenerateVariation(openItem)}
                  >
                    {isGeneratingVariation ? (
                      <>
                        <Sparkles className="size-4 animate-pulse" aria-hidden="true" />
                        Генерация вариации…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" aria-hidden="true" />
                        Сгенерировать вариацию
                      </>
                    )}
                    <WipBadge className="ml-1.5" />
                  </Button>
                  {openItem.isCharacter ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOpenId(null);
                        onOpenCharacter(openItem.entityId);
                      }}
                    >
                      <User className="size-4" aria-hidden="true" />
                      Открыть персонажа
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlbumTile({ item, onOpen }: { item: AlbumItem; onOpen: () => void }) {
  const kindMeta = ALBUM_KIND_META[item.kind];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-xl border bg-card text-left transition-all hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <GradientArt
        gradient={item.gradient}
        ariaLabel={`Заглушка работы: ${item.title}`}
        className="aspect-square w-full"
        iconClassName="size-10"
      >
        <span
          className={cn(
            "absolute left-2 top-2 rounded-full border border-border/60 bg-background/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground backdrop-blur-sm",
          )}
        >
          {kindMeta.label.toLowerCase()}
        </span>
        {item.isGenerated ? (
          <span className="absolute right-2 top-2 rounded-full border border-primary/50 bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary backdrop-blur-sm">
            новое
          </span>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ImageIcon className="size-3" aria-hidden="true" />
          Открыть
        </span>
      </GradientArt>
      <span className="block p-2.5">
        <span className="line-clamp-1 block text-xs font-medium">{item.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {item.entityName} · {agoLabel(item.createdAtAgo)}
        </span>
      </span>
    </button>
  );
}
