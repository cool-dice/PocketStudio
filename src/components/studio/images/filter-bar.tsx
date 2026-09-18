"use client";

import { ArrowUpDown, Check, ChevronDown, Heart, LayoutGrid, Palette, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SelectableChip } from "./chip";
import { IMAGE_STYLES } from "./gallery-data";

export type GalleryFilter = string; // "all" | "favorites" | название стиля
export type GallerySort = "new" | "old" | "popular";

function pluralImages(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} изображение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} изображения`;
  return `${n} изображений`;
}

/** Панель фильтров галереи: поиск, быстрые вкладки, стили и сортировка. */
export function FilterBar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  count,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  filter: GalleryFilter;
  onFilterChange: (v: GalleryFilter) => void;
  sort: GallerySort;
  onSortChange: (v: GallerySort) => void;
  count: number;
}) {
  const styleFilterActive = filter !== "all" && filter !== "favorites";

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
          aria-label="Поиск по промпту"
          className="pl-8"
        />
      </div>

      <SelectableChip
        label="Все"
        icon={LayoutGrid}
        selected={filter === "all"}
        onClick={() => onFilterChange("all")}
      />
      <SelectableChip
        label="Избранное"
        icon={Heart}
        selected={filter === "favorites"}
        onClick={() => onFilterChange("favorites")}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "h-8 rounded-full px-3 text-xs font-medium",
              styleFilterActive && "border-primary/60 bg-primary/10 text-primary hover:bg-primary/15",
            )}
          >
            <Palette className="size-3.5" aria-hidden="true" />
            {styleFilterActive ? filter : "По стилям"}
            <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {IMAGE_STYLES.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => onFilterChange(s)} className="text-xs">
              <Check
                className={cn("size-3.5", filter !== s && "invisible")}
                aria-hidden="true"
              />
              {s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-3">
        <p className="hidden text-xs text-muted-foreground md:block">{pluralImages(count)}</p>
        <Select value={sort} onValueChange={(v) => onSortChange(v as GallerySort)}>
          <SelectTrigger size="sm" className="h-8 rounded-full text-xs" aria-label="Сортировка">
            <ArrowUpDown className="size-3.5" aria-hidden="true" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">Новые</SelectItem>
            <SelectItem value="old">Старые</SelectItem>
            <SelectItem value="popular">Популярные</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </nav>
  );
}
