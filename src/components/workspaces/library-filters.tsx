"use client";

/**
 * LibraryFilterBar (A2-c) — панель каталогизации Библиотеки на живых
 * данных: поиск по названиям/описаниям/промптам, чип «Только избранное»,
 * чипы воркспейсов (api.listWorkspaces, с фасетными счётчиками) и
 * чипы типов артефактов со счётчиками.
 */

import { Heart, Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { ArtifactType, WorkspaceDto } from "@/lib/workspace-types";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";
import {
  LIBRARY_TYPE_META,
  LIBRARY_TYPE_ORDER,
  type LibraryKindFilter,
} from "@/components/workspaces/library-data";

interface LibraryFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  kind: LibraryKindFilter;
  onKindChange: (value: LibraryKindFilter) => void;
  kindCounts: Partial<Record<LibraryKindFilter, number>>;
  workspaces: WorkspaceDto[];
  workspaceId: string;
  onWorkspaceChange: (value: string) => void;
  workspaceCounts: Record<string, number>;
  favoritesOnly: boolean;
  onFavoritesChange: (value: boolean) => void;
}

export function LibraryFilterBar({
  query,
  onQueryChange,
  kind,
  onKindChange,
  kindCounts,
  workspaces,
  workspaceId,
  onWorkspaceChange,
  workspaceCounts,
  favoritesOnly,
  onFavoritesChange,
}: LibraryFilterBarProps) {
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
            placeholder="Поиск по названиям…"
            aria-label="Поиск артефактов"
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

        {/* Только избранное */}
        <LibraryChip
          icon={Heart}
          label="Только избранное"
          selected={favoritesOnly}
          onClick={() => onFavoritesChange(!favoritesOnly)}
          className="sm:ml-auto"
        />
      </div>

      {/* Чипы воркспейсов */}
      <div
        className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0"
        role="group"
        aria-label="Фильтр по воркспейсу"
      >
        <LibraryChip
          label="Все воркспейсы"
          selected={workspaceId === "all"}
          onClick={() => onWorkspaceChange("all")}
          count={
            Object.values(workspaceCounts).reduce((sum, n) => sum + n, 0)
          }
        />
        {workspaces.map((ws) => {
          const WsIcon = WORKSPACE_TYPE_META[ws.type]?.icon;
          return (
            <LibraryChip
              key={ws.id}
              icon={WsIcon}
              label={ws.name}
              selected={workspaceId === ws.id}
              onClick={() => onWorkspaceChange(ws.id)}
              count={workspaceCounts[ws.id] ?? 0}
            />
          );
        })}
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
          count={kindCounts.all ?? 0}
        />
        {LIBRARY_TYPE_ORDER.filter((type) => (kindCounts[type] ?? 0) > 0).map(
          (type) => {
            const meta = LIBRARY_TYPE_META[type as ArtifactType];
            return (
              <LibraryChip
                key={type}
                icon={meta.icon}
                label={meta.plural}
                selected={kind === type}
                onClick={() => onKindChange(type)}
                count={kindCounts[type] ?? 0}
              />
            );
          },
        )}
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
  className,
}: {
  icon?: LucideIcon;
  label: string;
  count?: number;
  selected: boolean;
  onClick: () => void;
  className?: string;
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
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      <span className="max-w-44 truncate">{label}</span>
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10px] font-semibold leading-none tabular-nums",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
