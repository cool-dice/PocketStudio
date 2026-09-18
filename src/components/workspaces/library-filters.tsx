"use client";

/**
 * LibraryFilterBar — панель каталогизации Библиотеки (PS-3-c):
 * поиск по названиям, чипы типов со счётчиками (фасетно: по базе,
 * отфильтрованной поиском и воркспейсом), фильтр по воркспейсу
 * (иконка типа + название), переключатель группировки по воркспейсам.
 */

import { Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ARTIFACT_KIND_META,
} from "@/components/workspaces/shared/artifacts-data";
import { MOCK_WORKSPACES, WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import {
  LIBRARY_KIND_CHIPS,
  type LibraryKindFilter,
} from "@/components/workspaces/library-data";

interface LibraryFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  kind: LibraryKindFilter;
  onKindChange: (value: LibraryKindFilter) => void;
  kindCounts: Record<LibraryKindFilter, number>;
  workspaceId: string;
  onWorkspaceChange: (value: string) => void;
  workspaceCounts: Record<string, number>;
  grouped: boolean;
  onGroupedChange: (value: boolean) => void;
}

export function LibraryFilterBar({
  query,
  onQueryChange,
  kind,
  onKindChange,
  kindCounts,
  workspaceId,
  onWorkspaceChange,
  workspaceCounts,
  grouped,
  onGroupedChange,
}: LibraryFilterBarProps) {
  return (
    <div className="shrink-0 space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {/* Поиск по названиям */}
        <div className="relative w-full sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Поиск по названиям…"
            aria-label="Поиск артефактов по названию"
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

        {/* Фильтр по воркспейсу */}
        <Select value={workspaceId} onValueChange={onWorkspaceChange}>
          <SelectTrigger
            className="h-8 w-full text-xs sm:w-60"
            aria-label="Фильтр по воркспейсу"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              <span className="font-medium">Все воркспейсы</span>
            </SelectItem>
            {MOCK_WORKSPACES.map((ws) => {
              const WsIcon = WORKSPACE_TYPE_META[ws.type].icon;
              const count = workspaceCounts[ws.id] ?? 0;
              return (
                <SelectItem key={ws.id} value={ws.id} className="text-xs">
                  <WsIcon className="size-3.5" aria-hidden="true" />
                  <span className="truncate">{ws.title}</span>
                  <span
                    className="ml-auto rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold leading-none tabular-nums text-muted-foreground"
                    aria-label={`${count} артефактов`}
                  >
                    {count}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Группировка по воркспейсам */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch
            id="library-group-switch"
            checked={grouped}
            onCheckedChange={onGroupedChange}
            aria-label="Группировать по воркспейсам"
          />
          <label
            htmlFor="library-group-switch"
            className="cursor-pointer select-none text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Группировать по воркспейсам
          </label>
        </div>
      </div>

      {/* Чипы типов со счётчиками */}
      <div
        className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0"
        role="group"
        aria-label="Фильтр по типу контента"
      >
        <LibraryChip
          label="Все"
          selected={kind === "all"}
          onClick={() => onKindChange("all")}
          count={kindCounts.all}
        />
        {LIBRARY_KIND_CHIPS.map((chip) => {
          const Icon = ARTIFACT_KIND_META[chip.kind].icon;
          return (
            <LibraryChip
              key={chip.kind}
              icon={Icon}
              label={chip.label}
              selected={kind === chip.kind}
              onClick={() => onKindChange(chip.kind)}
              count={kindCounts[chip.kind]}
            />
          );
        })}
      </div>
    </div>
  );
}

function LibraryChip({
  icon: Icon,
  label,
  count,
  selected,
  onClick,
}: {
  icon?: LucideIcon;
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-px text-[10px] font-semibold leading-none tabular-nums",
          selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
