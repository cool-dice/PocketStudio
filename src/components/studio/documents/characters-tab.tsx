"use client";

/**
 * Вкладка «Персонажи»: каталог персонажей романа. Поиск, фильтры
 * по роли со счётчиками, сортировка, избранное; карточки с
 * портретами-градиентами; детальная панель с таймлайном состояний
 * (см. character-sheet.tsx).
 */

import { ArrowUpDown, Check, Plus, Search, Star, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
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
import { CharacterSheet } from "./character-sheet";
import { GradientArt } from "./art-placeholder";
import { MiniChip, SelectableChip } from "./narrative-chip";
import { ageLabel, agoLabel } from "./narrative-data";
import {
  CHARACTER_ROLE_META,
  STORY_CHARACTERS,
  type CharacterRoleCategory,
  type StoryCharacter,
} from "./character-data";

type CharacterSort = "name" | "updated" | "chapters";

const SORT_ITEMS: { id: CharacterSort; label: string }[] = [
  { id: "name", label: "по имени" },
  { id: "updated", label: "по обновлению" },
  { id: "chapters", label: "по числу глав" },
];

const ROLE_FILTERS: { id: CharacterRoleCategory | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "main", label: "Главные" },
  { id: "secondary", label: "Второстепенные" },
  { id: "antagonist", label: "Антагонисты" },
];

export function CharactersTab({
  focusCharacterId,
  portraitOverrides,
  generatingPortraitId,
  onGeneratePortrait,
}: {
  focusCharacterId: string | null;
  portraitOverrides: Record<string, string>;
  generatingPortraitId: string | null;
  onGeneratePortrait: (character: StoryCharacter) => void;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<CharacterRoleCategory | "all">("all");
  const [sort, setSort] = useState<CharacterSort>("updated");
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(new Set());
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(focusCharacterId);

  const visible = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = STORY_CHARACTERS.filter((character) => {
      if (role !== "all" && character.roleCategory !== role) return false;
      if (favoritesOnly && !favorites.has(character.id)) return false;
      if (
        normalizedQuery &&
        !character.name.toLowerCase().includes(normalizedQuery) &&
        !character.role.toLowerCase().includes(normalizedQuery) &&
        !character.traits.some((trait) => trait.toLowerCase().includes(normalizedQuery))
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, "ru");
      if (sort === "chapters") return b.chapters.length - a.chapters.length;
      return a.updatedAgo - b.updatedAgo;
    });
  }, [query, role, sort, favorites, favoritesOnly]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Каталогизация */}
      <div className="shrink-0 space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold">Персонажи</h3>
            <p className="text-xs text-muted-foreground">
              {STORY_CHARACTERS.length} героев · {STORY_CHARACTERS.reduce((sum, c) => sum + c.relations.length, 0)} связей
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
                toast.info("Картотека героев", {
                  description: "Создание персонажей подключается на следующем этапе.",
                })
              }
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Персонаж
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
              placeholder="Поиск по имени, роли, черте…"
              aria-label="Поиск по персонажам"
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
            aria-label="Фильтр по ролям"
          >
            {ROLE_FILTERS.map((filter) => (
              <SelectableChip
                key={filter.id}
                label={filter.label}
                selected={role === filter.id}
                onClick={() => setRole(filter.id)}
                count={
                  filter.id === "all"
                    ? STORY_CHARACTERS.length
                    : STORY_CHARACTERS.filter((character) => character.roleCategory === filter.id).length
                }
              />
            ))}
            <SelectableChip
              label="Избранные"
              icon={Star}
              selected={favoritesOnly}
              onClick={() => setFavoritesOnly((prev) => !prev)}
              count={favorites.size}
            />
          </div>
        </div>
      </div>

      {/* Сетка карточек */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">Персонажей не нашлось</p>
            <p className="text-xs text-muted-foreground">
              Попробуйте другую роль или очистите поиск.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                favorite={favorites.has(character.id)}
                portraitGradientOverride={portraitOverrides[character.id]}
                onOpen={() => setOpenId(character.id)}
                onToggleFavorite={() => toggleFavorite(character.id)}
              />
            ))}
          </div>
        )}
      </div>

      <CharacterSheet
        characterId={openId}
        portraitGradientOverride={openId ? portraitOverrides[openId] : undefined}
        isGeneratingPortrait={generatingPortraitId !== null && generatingPortraitId === openId}
        onClose={() => setOpenId(null)}
        onOpenCharacter={(id) => setOpenId(id)}
        onGeneratePortrait={onGeneratePortrait}
      />
    </div>
  );
}

function CharacterCard({
  character,
  favorite,
  portraitGradientOverride,
  onOpen,
  onToggleFavorite,
}: {
  character: StoryCharacter;
  favorite: boolean;
  portraitGradientOverride?: string;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  const roleMeta = CHARACTER_ROLE_META[character.roleCategory];

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-sm">
      <button type="button" onClick={onOpen} className="text-left">
        <div className="relative">
          <GradientArt
            gradient={portraitGradientOverride ?? character.portraitGradient}
            initials={character.initials}
            ariaLabel={`Портрет-заглушка: ${character.name}`}
            className="aspect-[5/3] w-full border-b"
            iconClassName="text-5xl"
          />
          <span
            className={cn(
              "absolute left-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm",
              character.roleCategory === "main" && "border-primary/50 bg-primary/20 text-primary",
              character.roleCategory === "secondary" && "border-border bg-background/80 text-muted-foreground",
              character.roleCategory === "antagonist" &&
                "border-destructive/50 bg-destructive/15 text-destructive",
            )}
          >
            {roleMeta.single}
          </span>
        </div>
        <div className="p-4 pb-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h4 className="font-serif text-base font-semibold leading-tight">{character.name}</h4>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {ageLabel(character.age)}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{character.role}</p>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {character.traits.slice(0, 3).map((trait) => (
              <span
                key={trait}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                #{trait}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/80">
            <MiniChip title="Количество связей с другими персонажами">
              <Users className="size-3" aria-hidden="true" />
              {character.relations.length}
            </MiniChip>
            <MiniChip title="Появляется в главах">
              гл. {character.chapters[0]}–{character.chapters[character.chapters.length - 1]}
            </MiniChip>
            <span className="ml-auto">{agoLabel(character.updatedAgo)}</span>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? `Убрать ${character.name} из избранного` : `Добавить ${character.name} в избранное`}
        className={cn(
          "absolute right-2 top-2 flex size-7 items-center justify-center rounded-full border border-border/60 bg-background/80 backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          favorite ? "text-primary" : "text-muted-foreground/70",
        )}
      >
        <Star className={cn("size-3.5", favorite && "fill-primary")} aria-hidden="true" />
      </button>
    </article>
  );
}
