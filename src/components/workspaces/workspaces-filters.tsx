"use client";

/**
 * WorkspacesFilterBar — панель каталогизации списка воркспейсов
 * (PS-3-a): поиск, сортировка (обновление/прогресс/название) и чипы
 * типов со счётчиками (фасетно — по базе, отфильтрованной поиском).
 */

import { LayoutGrid, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import {
  WORKSPACES_SORT_OPTIONS,
  WORKSPACES_TYPE_CHIPS,
  type WorkspacesSort,
  type WorkspacesTypeFilter,
} from "@/components/workspaces/workspaces-data";

interface WorkspacesFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  type: WorkspacesTypeFilter;
  onTypeChange: (value: WorkspacesTypeFilter) => void;
  typeCounts: Record<WorkspacesTypeFilter, number>;
  sort: WorkspacesSort;
  onSortChange: (value: WorkspacesSort) => void;
}

export function WorkspacesFilterBar({
  query,
  onQueryChange,
  type,
  onTypeChange,
  typeCounts,
  sort,
  onSortChange,
}: WorkspacesFilterBarProps) {
  return (
    <div className="shrink-0 space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Поиск */}
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Поиск по названию или описанию…"
            aria-label="Поиск воркспейсов"
            className="h-8 pl-8 pr-8 text-xs"
          />
          {query !== "" ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Очистить поиск"
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Сортировка */}
        <div className="sm:ml-auto">
          <Select value={sort} onValueChange={(v) => onSortChange(v as WorkspacesSort)}>
            <SelectTrigger
              className="h-8 w-full text-xs sm:w-44"
              aria-label="Сортировка воркспейсов"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORKSPACES_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Чипы типов со счётчиками */}
      <div
        className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0"
        role="group"
        aria-label="Фильтр по типу воркспейса"
      >
        {WORKSPACES_TYPE_CHIPS.map((chip) => {
          const icon: LucideIcon | null =
            chip.id === "all" ? LayoutGrid : WORKSPACE_TYPE_META[chip.id].icon;
          const Icon = icon ?? LayoutGrid;
          const selected = type === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onTypeChange(chip.id)}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                selected
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {chip.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] font-semibold leading-none tabular-nums",
                  selected
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {typeCounts[chip.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
