"use client";

/**
 * LibraryScreen — «Библиотека» (PS-3-c): единый браузер контента
 * всех воркспейсов с каталогизацией: поиск, чипы типов со счётчиками,
 * фильтр по воркспейсу, сортировка, вид сетка/список, группировка по
 * воркспейсам, детальный диалог артефакта с переходом в воркспейс.
 * Визуальная волна: локальный стейт, мок-данные, без бэкенда.
 */

import {
  BookOpenText,
  Boxes,
  Clapperboard,
  LayoutGrid,
  Library as LibraryIcon,
  List as ListIcon,
  RotateCcw,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModuleHeader } from "@/components/studio/shared/module-header";
import { ArtifactCard } from "@/components/workspaces/shared/artifact-card";
import {
  MOCK_ARTIFACTS,
} from "@/components/workspaces/shared/artifacts-data";
import { LibraryArtifactDialog } from "@/components/workspaces/library-artifact-dialog";
import {
  LIBRARY_KIND_CHIPS,
  LIBRARY_SORT_OPTIONS,
  libraryGridClassName,
  matchesQuery,
  sortArtifacts,
  type LibraryKindFilter,
  type LibrarySort,
  type LibraryView,
} from "@/components/workspaces/library-data";
import { LibraryFilterBar } from "@/components/workspaces/library-filters";
import { LibrarySection } from "@/components/workspaces/library-section";
import { MOCK_WORKSPACES } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

/** Плитки статистики (считаются по мок-данным один раз). */
const LIBRARY_STATS: { label: string; value: number; icon: LucideIcon }[] = [
  {
    label: "Всего артефактов",
    value: MOCK_ARTIFACTS.length,
    icon: LibraryIcon,
  },
  {
    label: "Воркспейсов",
    value: MOCK_WORKSPACES.length,
    icon: Boxes,
  },
  {
    label: "Сцен и треков",
    value: MOCK_ARTIFACTS.filter(
      (a) => a.kind === "scene" || a.kind === "track",
    ).length,
    icon: Clapperboard,
  },
  {
    label: "Документов",
    value: MOCK_ARTIFACTS.filter(
      (a) => a.kind === "document" || a.kind === "portrait",
    ).length,
    icon: BookOpenText,
  },
];

export function LibraryScreen({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LibraryKindFilter>("all");
  const [workspaceId, setWorkspaceId] = useState("all");
  const [sort, setSort] = useState<LibrarySort>("date");
  const [view, setView] = useState<LibraryView>("grid");
  const [grouped, setGrouped] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  // Фасетная база: поиск не влияет на счётчики собственных измерений.
  const searchBase = useMemo(
    () => MOCK_ARTIFACTS.filter((a) => matchesQuery(a, query)),
    [query],
  );

  const kindCounts = useMemo(() => {
    const withinWorkspace = searchBase.filter(
      (a) => workspaceId === "all" || a.workspaceId === workspaceId,
    );
    const counts = {} as Record<LibraryKindFilter, number>;
    for (const chip of LIBRARY_KIND_CHIPS) {
      counts[chip.kind] = withinWorkspace.filter((a) => a.kind === chip.kind).length;
    }
    counts.all = withinWorkspace.length;
    return counts;
  }, [searchBase, workspaceId]);

  const workspaceCounts = useMemo(() => {
    const withinKind = searchBase.filter((a) => kind === "all" || a.kind === kind);
    const counts: Record<string, number> = {};
    for (const ws of MOCK_WORKSPACES) {
      counts[ws.id] = withinKind.filter((a) => a.workspaceId === ws.id).length;
    }
    return counts;
  }, [searchBase, kind]);

  const visible = useMemo(() => {
    const filtered = searchBase.filter(
      (a) =>
        (kind === "all" || a.kind === kind) &&
        (workspaceId === "all" || a.workspaceId === workspaceId),
    );
    return sortArtifacts(filtered, sort);
  }, [searchBase, kind, workspaceId, sort]);

  const sections = useMemo(
    () =>
      MOCK_WORKSPACES.map((ws) => ({
        workspace: ws,
        items: visible.filter((a) => a.workspaceId === ws.id),
      })).filter((section) => section.items.length > 0),
    [visible],
  );

  const openArtifact = useMemo(
    () => MOCK_ARTIFACTS.find((a) => a.id === openId) ?? null,
    [openId],
  );

  const hasActiveFilters =
    query.trim() !== "" || kind !== "all" || workspaceId !== "all";

  function resetFilters() {
    setQuery("");
    setKind("all");
    setWorkspaceId("all");
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ModuleHeader
        icon={LibraryIcon}
        title="Библиотека"
        description="Весь контент всех воркспейсов"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Select value={sort} onValueChange={(v) => setSort(v as LibrarySort)}>
          <SelectTrigger
            className="h-8 w-[148px] text-xs"
            aria-label="Сортировка артефактов"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIBRARY_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id} className="text-xs">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ViewToggle view={view} onChange={setView} />
      </ModuleHeader>

      <LibraryStatsRow />

      <LibraryFilterBar
        query={query}
        onQueryChange={setQuery}
        kind={kind}
        onKindChange={setKind}
        kindCounts={kindCounts}
        workspaceId={workspaceId}
        onWorkspaceChange={setWorkspaceId}
        workspaceCounts={workspaceCounts}
        grouped={grouped}
        onGroupedChange={setGrouped}
      />

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Показано{" "}
            <span className="font-medium tabular-nums text-foreground">
              {visible.length}
            </span>{" "}
            из {MOCK_ARTIFACTS.length} артефактов
            {workspaceId !== "all"
              ? ` · ${MOCK_WORKSPACES.find((ws) => ws.id === workspaceId)?.title ?? ""}`
              : ""}
          </p>
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={resetFilters}
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              Сбросить фильтры
            </Button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <LibraryEmptyState onReset={resetFilters} />
        ) : grouped ? (
          <div className="space-y-7">
            {sections.map((section) => (
              <LibrarySection
                key={section.workspace.id}
                workspace={section.workspace}
                items={section.items}
                view={view}
                onOpenArtifact={(a) => setOpenId(a.id)}
              />
            ))}
          </div>
        ) : (
          <div className={libraryGridClassName(view)}>
            {visible.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                showWorkspace
                onOpen={(a) => setOpenId(a.id)}
              />
            ))}
          </div>
        )}

        <p className="mt-6 pb-1 text-center text-[10px] text-muted-foreground">
          Каталогизация поверх воркспейсов · данные подключаются в фазе A
        </p>
      </div>

      <LibraryArtifactDialog
        artifact={openArtifact}
        favorite={openArtifact !== null && favorites.has(openArtifact.id)}
        onToggleFavorite={toggleFavorite}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
      />
    </div>
  );
}

function LibraryStatsRow() {
  return (
    <div
      role="group"
      aria-label="Статистика библиотеки"
      className="grid shrink-0 grid-cols-2 gap-2 border-b px-4 py-4 sm:grid-cols-4 sm:px-6"
    >
      {LIBRARY_STATS.map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:border-primary/30"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <stat.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xl font-semibold leading-none tabular-nums">
              {stat.value}
            </p>
            <p
              className="mt-1 truncate text-[11px] text-muted-foreground"
              title={stat.label}
            >
              {stat.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: LibraryView;
  onChange: (view: LibraryView) => void;
}) {
  return (
    <div
      className="flex items-center rounded-lg border bg-background p-0.5"
      role="group"
      aria-label="Вид библиотеки"
    >
      {(
        [
          { id: "grid", label: "Сетка", icon: LayoutGrid },
          { id: "list", label: "Список", icon: ListIcon },
        ] as const
      ).map((option) => {
        const active = view === option.id;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.icon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function LibraryEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <span
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <SearchX className="size-6" />
      </span>
      <div>
        <p className="text-sm font-medium">Ничего не найдено</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Под текущие фильтры не попал ни один артефакт из {MOCK_ARTIFACTS.length}.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Сбросить фильтры
      </Button>
    </div>
  );
}
