"use client";

/**
 * WorkspacesScreen — «Воркспейсы» (Фаза A): живой список из БД
 * (/api/workspaces) с каталогизацией (чипы типов, поиск, фильтр стадии,
 * сортировка), сетка карточек, скелетоны загрузки,
 * состояние ошибки с повтором и мастер создания воркспейса.
 * Default list hides archived; «Показать архив» loads `?archived=1`.
 */

import { useMemo, useState } from "react";
import { FolderKanban, Plus, RotateCcw, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleHeader } from "@/components/studio/shared/module-header";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { WorkspacesCard } from "@/components/workspaces/workspaces-card";
import { WorkspacesFilterBar } from "@/components/workspaces/workspaces-filters";
import {
  matchesWorkspaceQuery,
  sortWorkspaces,
  stageLabelOf,
  WORKSPACES_TYPE_CHIPS,
  type WorkspacesSort,
  type WorkspacesTypeFilter,
} from "@/components/workspaces/workspaces-data";
import {
  patchCachedWorkspace,
  useWorkspacesGrid,
} from "@/hooks/use-workspaces";
import { useAppUi } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import {
  WORKSPACES_FAVORITE_FAILED,
  WORKSPACES_HIDE_ARCHIVE,
  WORKSPACES_LOAD_ERROR,
  WORKSPACES_LOAD_ERROR_HINT,
  WORKSPACES_RETRY,
  WORKSPACES_SHOW_ARCHIVE,
  workspacesEmptyCopy,
  workspacesListView,
} from "@/lib/workspace-copy";
import { toast } from "sonner";

export function WorkspacesScreen({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const {
    workspaces,
    loading,
    error,
    load,
    showArchived,
    toggleShowArchived,
  } = useWorkspacesGrid();

  const [query, setQuery] = useState("");
  const [type, setType] = useState<WorkspacesTypeFilter>("all");
  const [stage, setStage] = useState<string>("all");
  const [sort, setSort] = useState<WorkspacesSort>("updated");
  const [createOpen, setCreateOpen] = useState(false);

  /** Фасетная база: поиск не влияет на счётчики чипов и список стадий. */
  const searchBase = useMemo(
    () => workspaces.filter((ws) => matchesWorkspaceQuery(ws, query)),
    [workspaces, query],
  );

  const typeCounts = useMemo(() => {
    const counts = { all: searchBase.length } as Record<
      WorkspacesTypeFilter,
      number
    >;
    for (const chip of WORKSPACES_TYPE_CHIPS) {
      if (chip.id === "all") continue;
      counts[chip.id] = searchBase.filter((ws) => ws.type === chip.id).length;
    }
    return counts;
  }, [searchBase]);

  /** Живые стадии найденной базы — опции фильтра стадии. */
  const stageOptions = useMemo(
    () =>
      Array.from(new Set(searchBase.map((ws) => stageLabelOf(ws)))).sort((a, b) =>
        a.localeCompare(b, "ru"),
      ),
    [searchBase],
  );

  const visible = useMemo(
    () =>
      sortWorkspaces(
        searchBase.filter(
          (ws) =>
            (type === "all" || ws.type === type) &&
            (stage === "all" || stageLabelOf(ws) === stage),
        ),
        sort,
      ),
    [searchBase, type, stage, sort],
  );

  const hasActiveFilters = query.trim() !== "" || type !== "all" || stage !== "all";

  function resetFilters() {
    setQuery("");
    setType("all");
    setStage("all");
  }

  const listView = workspacesListView(loading, error, workspaces.length);
  const emptyCopy = workspacesEmptyCopy(showArchived);
  const showSkeleton = listView === "loading" && workspaces.length === 0;
  const showError = listView === "error" && workspaces.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ModuleHeader
        icon={FolderKanban}
        title="Воркспейсы"
        description="Каждый замысел — отдельный контекст: от заметок до фильма и приложения"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden="true" />
          Создать воркспейс
        </Button>
      </ModuleHeader>

      <WorkspacesFilterBar
        query={query}
        onQueryChange={setQuery}
        type={type}
        onTypeChange={setType}
        typeCounts={typeCounts}
        stage={stage}
        onStageChange={setStage}
        stageOptions={stageOptions}
        sort={sort}
        onSortChange={setSort}
      />

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {showArchived ? "Архив · " : null}
            Показано{" "}
            <span className="font-medium tabular-nums text-foreground">
              {visible.length}
            </span>{" "}
            из {workspaces.length} воркспейсов
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
          <button
            type="button"
            aria-pressed={showArchived}
            onClick={() => void toggleShowArchived()}
            className="ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {showArchived ? WORKSPACES_HIDE_ARCHIVE : WORKSPACES_SHOW_ARCHIVE}
          </button>
        </div>

        {showSkeleton ? (
          <WorkspacesSkeleton />
        ) : showError ? (
          <WorkspacesErrorState onRetry={load} />
        ) : visible.length === 0 ? (
          <WorkspacesEmptyState
            onReset={resetFilters}
            filtered={hasActiveFilters}
            title={
              hasActiveFilters ? "Ничего не найдено" : emptyCopy.title
            }
            hint={
              hasActiveFilters
                ? `Под текущие фильтры не попал ни один воркспейс из ${workspaces.length}.`
                : emptyCopy.hint
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((ws) => (
              <WorkspacesCard
                key={ws.id}
                workspace={ws}
                onOpen={(id) => openWorkspace(id)}
                onToggleFavorite={(id, next) => {
                  void api.updateWorkspace(id, { favorite: next }).then(
                    (updated) => {
                      patchCachedWorkspace(id, { favorite: updated.favorite });
                    },
                    (err) => {
                      toast.error(
                        err instanceof ApiError
                          ? err.message
                          : WORKSPACES_FAVORITE_FAILED,
                      );
                    },
                  );
                }}
              />
            ))}
          </div>
        )}

        <p className="mt-6 pb-1 text-center text-[10px] text-muted-foreground">
          Воркспейсы, стадии и счётчики — живые данные из БД студии · Фаза A
        </p>
      </div>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

/** Сетка скелетонов на время первичной загрузки списка. */
function WorkspacesSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Загрузка списка воркспейсов"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-xl border bg-card"
        >
          <Skeleton className="h-28 w-full rounded-none sm:h-32" />
          <div className="space-y-2.5 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-1.5 w-full" />
            <div className="flex items-center gap-2 pt-1">
              {Array.from({ length: 6 }, (_, j) => (
                <Skeleton key={j} className="size-3.5 rounded-sm" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Ошибка загрузки — повтор доступен одним кликом. */
function WorkspacesErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <span
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <SearchX className="size-6" />
      </span>
      <div>
        <p className="text-sm font-medium">{WORKSPACES_LOAD_ERROR}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {WORKSPACES_LOAD_ERROR_HINT}
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        {WORKSPACES_RETRY}
      </Button>
    </div>
  );
}

function WorkspacesEmptyState({
  onReset,
  filtered,
  title,
  hint,
}: {
  onReset: () => void;
  filtered: boolean;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <span
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <SearchX className="size-6" />
      </span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      {filtered ? (
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Сбросить
        </Button>
      ) : null}
    </div>
  );
}
