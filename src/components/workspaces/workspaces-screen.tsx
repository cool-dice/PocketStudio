"use client";

/**
 * WorkspacesScreen — «Воркспейсы» (PS-3-a): список всех воркспейсов
 * с каталогизацией (чипы типов со счётчиками, поиск, сортировка),
 * сетка карточек с избранным и мастер создания воркспейса.
 * Визуальная волна: локальный стейт, мок-данные, без бэкенда.
 */

import { useMemo, useState } from "react";
import { FolderKanban, Plus, RotateCcw, SearchX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ModuleHeader } from "@/components/studio/shared/module-header";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { WorkspacesCard } from "@/components/workspaces/workspaces-card";
import { WorkspacesFilterBar } from "@/components/workspaces/workspaces-filters";
import {
  matchesWorkspaceQuery,
  sortWorkspaces,
  WORKSPACES_TYPE_CHIPS,
  type WorkspacesSort,
  type WorkspacesTypeFilter,
} from "@/components/workspaces/workspaces-data";
import { useAppUi } from "@/lib/store";
import { MOCK_WORKSPACES } from "@/lib/workspace-data";

export function WorkspacesScreen({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);

  const [query, setQuery] = useState("");
  const [type, setType] = useState<WorkspacesTypeFilter>("all");
  const [sort, setSort] = useState<WorkspacesSort>("updated");
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);

  /** Фасетная база: поиск не влияет на счётчики чипов типов. */
  const searchBase = useMemo(
    () => MOCK_WORKSPACES.filter((ws) => matchesWorkspaceQuery(ws, query)),
    [query],
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

  const visible = useMemo(
    () =>
      sortWorkspaces(
        searchBase.filter((ws) => type === "all" || ws.type === type),
        sort,
      ),
    [searchBase, type, sort],
  );

  const hasActiveFilters = query.trim() !== "" || type !== "all";

  function resetFilters() {
    setQuery("");
    setType("all");
  }

  function toggleFavorite(id: string) {
    const title = MOCK_WORKSPACES.find((ws) => ws.id === id)?.title ?? "Воркспейс";
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        toast("Убрано из избранного", { description: `«${title}»` });
      } else {
        next.add(id);
        toast("Добавлено в избранное", { description: `«${title}»` });
      }
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ModuleHeader
        icon={FolderKanban}
        title="Воркспейсы"
        description="Каждый замысел — отдельный контекст: от заметок до фильма и приложения"
        stage="wip"
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
        sort={sort}
        onSortChange={setSort}
      />

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Показано{" "}
            <span className="font-medium tabular-nums text-foreground">
              {visible.length}
            </span>{" "}
            из {MOCK_WORKSPACES.length} воркспейсов
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
          <WorkspacesEmptyState onReset={resetFilters} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((ws) => (
              <WorkspacesCard
                key={ws.id}
                workspace={ws}
                favorite={favorites.has(ws.id)}
                onToggleFavorite={toggleFavorite}
                onOpen={(item) => openWorkspace(item.id)}
              />
            ))}
          </div>
        )}

        <p className="mt-6 pb-1 text-center text-[10px] text-muted-foreground">
          Каждый воркспейс — единый контекст: заметки, документы, медиа, код ·
          {" "}хранение подключается в фазе A
        </p>
      </div>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function WorkspacesEmptyState({ onReset }: { onReset: () => void }) {
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
          Под текущие фильтры не попал ни один воркспейс из {MOCK_WORKSPACES.length}.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Сбросить
      </Button>
    </div>
  );
}
