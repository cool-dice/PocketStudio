"use client";

/**
 * LibraryScreen (A2-c) — «Библиотека» на живых данных: весь контент
 * всех воркспейсов пользователя из api.listAllArtifacts(). Секции по
 * типам (Изображения / Портреты / Треки / Сцены / Документы / Заметки /
 * Файлы…), фильтр по воркспейсу чипами (api.listWorkspaces), поиск,
 * избранное (api.updateArtifact), сортировка и вид сетка/список.
 */

import {
  BookOpenText,
  Boxes,
  Clapperboard,
  LayoutGrid,
  Library as LibraryIcon,
  List as ListIcon,
  RefreshCw,
  RotateCcw,
  SearchX,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ModuleHeader } from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { LIBRARY_FAVORITE_FAILED } from "@/lib/library-copy";
import type { ArtifactDto, WorkspaceDto } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";
import { LibraryArtifactDialog } from "@/components/workspaces/library-artifact-dialog";
import {
  LIBRARY_SORT_OPTIONS,
  LIBRARY_TYPE_ORDER,
  matchesQuery,
  sortArtifacts,
  type LibraryKindFilter,
  type LibrarySort,
  type LibraryView,
} from "@/components/workspaces/library-data";
import { LibraryFilterBar } from "@/components/workspaces/library-filters";
import { LibrarySection } from "@/components/workspaces/library-section";

export function LibraryScreen({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  /* Живые данные. */
  const [artifacts, setArtifacts] = useState<ArtifactDto[] | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* Каталогизация. */
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<LibraryKindFilter>("all");
  const [workspaceId, setWorkspaceId] = useState("all");
  const [sort, setSort] = useState<LibrarySort>("date");
  const [view, setView] = useState<LibraryView>("grid");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  /* Диалог артефакта. */
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [all, ws] = await Promise.all([
        api.listAllArtifacts(),
        api.listWorkspaces(),
      ]);
      setArtifacts(all.filter((item) => item.type !== "app" && item.type !== "deploy"));
      setWorkspaces(ws);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : "Не удалось загрузить библиотеку",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const workspaceById = useMemo(
    () => Object.fromEntries(workspaces.map((ws) => [ws.id, ws])),
    [workspaces],
  );

  /* Избранное — оптимистично; успех тостит диалог только после PATCH. */
  const toggleFavorite = useCallback(
    async (artifact: ArtifactDto): Promise<boolean> => {
      const next = !artifact.favorite;
      setArtifacts((prev) =>
        prev
          ? prev.map((a) => (a.id === artifact.id ? { ...a, favorite: next } : a))
          : prev,
      );
      try {
        await api.updateArtifact(artifact.id, { favorite: next });
        return true;
      } catch {
        setArtifacts((prev) =>
          prev
            ? prev.map((a) => (a.id === artifact.id ? { ...a, favorite: artifact.favorite } : a))
            : prev,
        );
        toast.error(LIBRARY_FAVORITE_FAILED);
        return false;
      }
    },
    [],
  );

  /* Фасетная база: поиск не влияет на счётчики остальных измерений. */
  const searchBase = useMemo(
    () => (artifacts ?? []).filter((a) => matchesQuery(a, query)),
    [artifacts, query],
  );

  const kindCounts = useMemo(() => {
    const scoped = searchBase.filter(
      (a) =>
        (workspaceId === "all" || a.projectId === workspaceId) &&
        (!favoritesOnly || a.favorite),
    );
    const counts: Partial<Record<LibraryKindFilter, number>> = {
      all: scoped.length,
    };
    for (const type of LIBRARY_TYPE_ORDER) {
      counts[type] = scoped.filter((a) => a.type === type).length;
    }
    return counts;
  }, [searchBase, workspaceId, favoritesOnly]);

  const workspaceCounts = useMemo(() => {
    const scoped = searchBase.filter(
      (a) =>
        (kind === "all" || a.type === kind) && (!favoritesOnly || a.favorite),
    );
    const counts: Record<string, number> = {};
    for (const ws of workspaces) {
      counts[ws.id] = scoped.filter((a) => a.projectId === ws.id).length;
    }
    return counts;
  }, [searchBase, kind, favoritesOnly, workspaces]);

  const visible = useMemo(() => {
    const filtered = searchBase.filter(
      (a) =>
        (kind === "all" || a.type === kind) &&
        (workspaceId === "all" || a.projectId === workspaceId) &&
        (!favoritesOnly || a.favorite),
    );
    return sortArtifacts(filtered, sort);
  }, [searchBase, kind, workspaceId, favoritesOnly, sort]);

  const sections = useMemo(
    () =>
      LIBRARY_TYPE_ORDER.map((type) => ({
        type,
        items: visible.filter((a) => a.type === type),
      })).filter((section) => section.items.length > 0),
    [visible],
  );

  const openArtifact = useMemo(
    () => (artifacts ?? []).find((a) => a.id === openId) ?? null,
    [artifacts, openId],
  );

  const hasActiveFilters =
    query.trim() !== "" ||
    kind !== "all" ||
    workspaceId !== "all" ||
    favoritesOnly;

  function resetFilters() {
    setQuery("");
    setKind("all");
    setWorkspaceId("all");
    setFavoritesOnly(false);
  }

  const total = artifacts?.length ?? 0;
  const stats = useMemo(() => {
    const list = artifacts ?? [];
    return [
      { label: "Всего артефактов", value: list.length, icon: LibraryIcon },
      { label: "Воркспейсов", value: workspaces.length, icon: Boxes },
      {
        label: "Изображений и портретов",
        value: list.filter((a) => a.type === "image" || a.type === "portrait")
          .length,
        icon: BookOpenText,
      },
      {
        label: "Треков и сцен",
        value: list.filter((a) => a.type === "track" || a.type === "scene").length,
        icon: Clapperboard,
      },
    ];
  }, [artifacts, workspaces]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ModuleHeader
        icon={LibraryIcon}
        title="Библиотека"
        description="Весь контент всех воркспейсов"
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as LibrarySort)}
          disabled={loading}
        >
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

      <LibraryStatsRow stats={stats} loading={loading} />

      <LibraryFilterBar
        query={query}
        onQueryChange={setQuery}
        kind={kind}
        onKindChange={setKind}
        kindCounts={kindCounts}
        workspaces={workspaces}
        workspaceId={workspaceId}
        onWorkspaceChange={setWorkspaceId}
        workspaceCounts={workspaceCounts}
        favoritesOnly={favoritesOnly}
        onFavoritesChange={setFavoritesOnly}
      />

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {loading || artifacts === null ? (
              loadError ? "Не удалось загрузить библиотеку" : "Загружаем библиотеку…"
            ) : (
              <>
                Показано{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {visible.length}
                </span>{" "}
                из {total} артефактов
                {workspaceId !== "all"
                  ? ` · ${workspaceById[workspaceId]?.name ?? ""}`
                  : ""}
              </>
            )}
          </p>
          {hasActiveFilters && !loading ? (
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

        {loading ? (
          <div className="space-y-7">
            {Array.from({ length: 2 }, (_, sectionIdx) => (
              <div key={sectionIdx}>
                <Skeleton className="mb-3 h-9 w-48 rounded-xl" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton
                      key={i}
                      className="h-[74px] w-full rounded-xl"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Повторить
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <LibraryEmptyState
            onReset={resetFilters}
            total={total}
            filtered={hasActiveFilters && total > 0}
          />
        ) : (
          <div className="space-y-7">
            {sections.map((section) => (
              <LibrarySection
                key={section.type}
                type={section.type}
                items={section.items}
                view={view}
                workspaceById={workspaceById}
                onOpenArtifact={(a) => setOpenId(a.id)}
                onToggleFavorite={(a) => void toggleFavorite(a)}
              />
            ))}
          </div>
        )}

        <p className="mt-6 pb-1 text-center text-[10px] text-muted-foreground">
          Каталогизация поверх воркспейсов · живые артефакты из базы студии
        </p>
      </div>

      <LibraryArtifactDialog
        artifact={openArtifact}
        workspaceById={workspaceById}
        onOpenChange={(open) => {
          if (!open) setOpenId(null);
        }}
        onToggleFavorite={(a) => void toggleFavorite(a)}
      />
    </div>
  );
}

function LibraryStatsRow({
  stats,
  loading,
}: {
  stats: { label: string; value: number; icon: LucideIcon }[];
  loading: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Статистика библиотеки"
      className="grid shrink-0 grid-cols-2 gap-2 border-b px-4 py-4 sm:grid-cols-4 sm:px-6"
    >
      {stats.map((stat) => (
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
            {loading ? (
              <Skeleton className="h-5 w-10 rounded" />
            ) : (
              <p className="text-xl font-semibold leading-none tabular-nums">
                {stat.value}
              </p>
            )}
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

function LibraryEmptyState({
  onReset,
  total,
  filtered,
}: {
  onReset: () => void;
  total: number;
  filtered: boolean;
}) {
  if (!filtered) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <LibraryIcon className="size-6" />
        </span>
        <div>
          <p className="text-sm font-medium">Библиотека пуста</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Здесь появятся артефакты из ваших воркспейсов — изображения, треки,
            сцены и документы.
          </p>
        </div>
      </div>
    );
  }

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
          Под текущие фильтры не попал ни один артефакт из {total}.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onReset}>
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Сбросить фильтры
      </Button>
    </div>
  );
}
