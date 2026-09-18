"use client";

/**
 * Вкладка «Сущности»: универсальный каталог записей воркспейса.
 * Два набора — «Хроники Долгой Зимы» (лор романа) и «Спека
 * PocketStudio» (пользователи, роли, требования, модули): виды
 * сущностей меняются под задачу. Поиск и фильтры по видам со
 * счётчиками, сортировка; карточки со связями и упоминаниями.
 * Персонажи открываются в CharacterSheet (портретный мок-флоу),
 * прочие записи — в универсальной EntitySheet.
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
import { GradientArt } from "./art-placeholder";
import { CharacterSheet } from "./character-sheet";
import { EntitySheet } from "./entity-sheet";
import { MiniChip, SelectableChip } from "./narrative-chip";
import { agoLabel } from "./narrative-data";
import {
  CHARACTER_ROLE_META,
  getCharacter,
  type StoryCharacter,
} from "./character-data";
import { pluralRu } from "./types";
import {
  ENTITY_KIND_META,
  ENTITY_SETS,
  GENERATED_ENTITY_TEMPLATES,
  getEntity,
  getEntitySet,
  kindsOfSet,
  type EntityKind,
  type EntitySet,
  type StudioEntity,
} from "./entities-data";

type EntitySort = "title" | "updated";

const SORT_ITEMS: { id: EntitySort; label: string }[] = [
  { id: "title", label: "по названию" },
  { id: "updated", label: "по обновлению" },
];

/** Набор, в котором живёт сущность из альбома (фокус при открытии вкладки). */
function initialSetId(focusEntityId: string | null): string {
  if (!focusEntityId) return ENTITY_SETS[0].id;
  const set = ENTITY_SETS.find((candidate) =>
    candidate.entities.some((entity) => entity.id === focusEntityId),
  );
  return set?.id ?? ENTITY_SETS[0].id;
}

export function EntitiesTab({
  focusEntityId,
  portraitOverrides,
  generatingPortraitId,
  onGeneratePortrait,
}: {
  focusEntityId: string | null;
  portraitOverrides: Record<string, string>;
  generatingPortraitId: string | null;
  onGeneratePortrait: (character: StoryCharacter) => void;
}) {
  const [setId, setSetId] = useState(() => initialSetId(focusEntityId));
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<EntityKind | "all">("all");
  const [sort, setSort] = useState<EntitySort>("updated");
  const [openId, setOpenId] = useState<string | null>(focusEntityId);
  const [generated, setGenerated] = useState<Record<string, string>>({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const activeSet = getEntitySet(setId) ?? ENTITY_SETS[0];
  const kinds = useMemo(() => kindsOfSet(activeSet), [activeSet]);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = activeSet.entities.filter((entity) => {
      if (kind !== "all" && entity.kind !== kind) return false;
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
  }, [activeSet, query, kind, sort]);

  /** Смена набора: проверка не наследуется — сбрасываем всё локальное. */
  function switchSet(nextId: string) {
    if (nextId === setId) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setSetId(nextId);
    setQuery("");
    setKind("all");
    setOpenId(null);
    setGenerated({});
    setGeneratingId(null);
  }

  /** Мок «Сгенерировать описание»: спиннер → абзац в карточку + тост. */
  function handleGenerate(entity: StudioEntity) {
    if (generatingId !== null) return;
    setGeneratingId(entity.id);
    timerRef.current = window.setTimeout(() => {
      setGenerated((prev) => ({ ...prev, [entity.id]: GENERATED_ENTITY_TEMPLATES[entity.kind] }));
      setGeneratingId(null);
      toast.success("Описание сгенерировано", {
        description: `Черновик абзаца добавлен в карточку «${entity.name}».`,
      });
    }, 1500);
  }

  const openEntity = openId
    ? activeSet.entities.find((entity) => entity.id === openId)
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Каталогизация: набор, поиск, фильтры, сортировка */}
      <div className="shrink-0 space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Сущности</h3>
            <p className="text-xs text-muted-foreground">
              {activeSet.label}: {activeSet.entities.length}{" "}
              {pluralRu(activeSet.entities.length, "запись", "записи", "записей")} ·{" "}
              {activeSet.hint} ·{" "}
              <span className="text-[11px] text-muted-foreground/70">
                виды меняются под задачу: от лора мира до ролей и требований
              </span>
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
                toast.info("Конструктор сущностей", {
                  description: "Создание записей подключается на следующем этапе.",
                })
              }
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Запись
            </Button>
          </div>
        </div>

        {/* Переключатель набора */}
        <div
          className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5"
          role="group"
          aria-label="Набор сущностей"
        >
          {ENTITY_SETS.map((set) => (
            <SelectableChip
              key={set.id}
              label={set.label}
              icon={set.icon}
              selected={activeSet.id === set.id}
              onClick={() => switchSet(set.id)}
            />
          ))}
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
              placeholder="Поиск по названию или тегу…"
              aria-label="Поиск по сущностям"
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
            aria-label="Фильтр по виду сущности"
          >
            <SelectableChip
              label="Все"
              selected={kind === "all"}
              onClick={() => setKind("all")}
              count={activeSet.entities.length}
            />
            {kinds.map((kindId) => (
              <SelectableChip
                key={kindId}
                label={ENTITY_KIND_META[kindId].plural}
                selected={kind === kindId}
                onClick={() => setKind(kindId)}
                count={activeSet.entities.filter((entity) => entity.kind === kindId).length}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Сетка карточек сущностей */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">Сущностей не нашлось</p>
            <p className="text-xs text-muted-foreground">
              Попробуйте другой вид или очистите поиск.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                set={activeSet}
                portraitGradientOverride={portraitOverrides[entity.id]}
                hasGenerated={Boolean(generated[entity.id])}
                onOpen={() => setOpenId(entity.id)}
                onOpenRelated={(id) => setOpenId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Детальные панели: персонажи — CharacterSheet, прочее — EntitySheet */}
      {openEntity?.kind === "character" ? (
        <CharacterSheet
          characterId={openEntity.id}
          portraitGradientOverride={portraitOverrides[openEntity.id]}
          isGeneratingPortrait={generatingPortraitId === openEntity.id}
          onClose={() => setOpenId(null)}
          onOpenCharacter={(id) => setOpenId(id)}
          onGeneratePortrait={onGeneratePortrait}
        />
      ) : (
        <EntitySheet
          setId={activeSet.id}
          entityId={openEntity ? openEntity.id : null}
          onClose={() => setOpenId(null)}
          onOpenEntity={(id) => setOpenId(id)}
          generated={generated}
          generatingId={generatingId}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}

function EntityCard({
  entity,
  set,
  portraitGradientOverride,
  hasGenerated,
  onOpen,
  onOpenRelated,
}: {
  entity: StudioEntity;
  set: EntitySet;
  portraitGradientOverride?: string;
  hasGenerated: boolean;
  onOpen: () => void;
  onOpenRelated: (id: string) => void;
}) {
  const meta = ENTITY_KIND_META[entity.kind];
  const KindIcon = meta.icon;
  const isNarrative = set.domain === "narrative";
  const character = entity.kind === "character" ? getCharacter(entity.id) : undefined;
  const roleMeta = character ? CHARACTER_ROLE_META[character.roleCategory] : null;

  return (
    <article className="group flex flex-col rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-sm">
      <button type="button" onClick={onOpen} className="flex-1 text-left">
        {character && entity.portrait ? (
          <div className="relative">
            <GradientArt
              gradient={portraitGradientOverride ?? entity.portrait.gradient}
              initials={entity.portrait.initials}
              ariaLabel={`Портрет-заглушка: ${entity.name}`}
              className="aspect-[5/3] w-full border-b"
              iconClassName="text-5xl"
            />
            {roleMeta ? (
              <span
                className={cn(
                  "absolute left-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm",
                  character.roleCategory === "main" && "border-primary/50 bg-primary/20 text-primary",
                  character.roleCategory === "secondary" && "border-border bg-background/80 text-muted-foreground",
                  character.roleCategory === "antagonist" && "border-destructive/50 bg-destructive/15 text-destructive",
                )}
              >
                {roleMeta.single}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <KindIcon className="size-4" />
            </span>
            <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {meta.label}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70">
              {agoLabel(entity.updatedAgo)}
            </span>
          </div>
          <h4
            className={cn(
              "mt-2.5 text-base font-semibold leading-tight",
              isNarrative && "font-serif",
            )}
          >
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
            <span className="text-[11px] text-muted-foreground/80">
              {isNarrative ? "упомянута в:" : "разделы:"}
            </span>
            {entity.refs.items.map((ref) => (
              <span
                key={ref}
                className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary"
              >
                {isNarrative ? `гл. ${ref}` : ref}
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

      {entity.related.length > 0 ? (
        <div className="mt-auto border-t px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/80">связи:</span>
            {entity.related.map((relatedId) => {
              const related = getEntity(set.id, relatedId);
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
      ) : null}
    </article>
  );
}
