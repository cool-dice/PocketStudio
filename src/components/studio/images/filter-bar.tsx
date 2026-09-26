"use client";

/**
 * FilterBar (A2-c) — панель каталогизации галереи на живых данных:
 * поиск (по названию и промпту), быстрые фильтры (Все / Избранное /
 * Изображения / Портреты с фасетными счётчиками), сортировка
 * (новые / старые / по названию) и счётчик видимых работ.
 */

import { ArrowUpDown, Heart, Image as ImageIcon, LayoutGrid, Search, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectableChip } from "./chip";
import { pluralImages } from "./gallery-data";

export type GalleryFilter = "all" | "favorites" | "image" | "portrait";
export type GallerySort = "new" | "old" | "title";

export function FilterBar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  counts,
  sort,
  onSortChange,
  count,
  disabled,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  filter: GalleryFilter;
  onFilterChange: (v: GalleryFilter) => void;
  counts: { all: number; favorites: number; image: number; portrait: number };
  sort: GallerySort;
  onSortChange: (v: GallerySort) => void;
  count: number;
  disabled?: boolean;
}) {
  return (
    <nav
      aria-label="Фильтры галереи"
      className="flex shrink-0 flex-wrap items-center gap-2"
    >
      <div className="relative w-full sm:w-60">
        <Search
          className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Поиск по промпту…"
          aria-label="Поиск по промпту и названию"
          className="pl-8"
        />
      </div>

      <div
        className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0"
        role="group"
        aria-label="Быстрые фильтры"
      >
        <SelectableChip
          label="Все"
          icon={LayoutGrid}
          selected={filter === "all"}
          onClick={() => onFilterChange("all")}
          count={counts.all}
          disabled={disabled}
        />
        <SelectableChip
          label="Избранное"
          icon={Heart}
          selected={filter === "favorites"}
          onClick={() => onFilterChange("favorites")}
          count={counts.favorites}
          disabled={disabled}
        />
        <SelectableChip
          label="Изображения"
          icon={ImageIcon}
          selected={filter === "image"}
          onClick={() => onFilterChange("image")}
          count={counts.image}
          disabled={disabled}
        />
        <SelectableChip
          label="Портреты"
          icon={UserRound}
          selected={filter === "portrait"}
          onClick={() => onFilterChange("portrait")}
          count={counts.portrait}
          disabled={disabled}
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <p className="hidden text-xs text-muted-foreground md:block">
          {pluralImages(count)}
        </p>
        <Select
          value={sort}
          onValueChange={(v) => onSortChange(v as GallerySort)}
          disabled={disabled}
        >
          <SelectTrigger size="sm" className="h-8 rounded-full text-xs" aria-label="Сортировка">
            <ArrowUpDown className="size-3.5" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Новые</SelectItem>
            <SelectItem value="old">Старые</SelectItem>
            <SelectItem value="title">По названию</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
