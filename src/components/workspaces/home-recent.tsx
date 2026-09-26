"use client";

/**
 * HomeRecent — «Продолжить работу» на Главной (Фаза A):
 * недавние воркспейсы из БД (useWorkspaces, первые `limit`).
 * `variant="grid"` — вертикальная карточка с градиентным баннером
 * для сетки дашборда (sm+), `variant="compact"` — горизонтальная
 * компактная строка (мобайл). Скелетоны на время загрузки.
 */

import { ArrowUpRight, RotateCcw } from "lucide-react";

import { timeAgo } from "@/components/workspaces/home-data";
import { pluralRu } from "@/components/workspaces/overview-data";
import {
  stageLabelOf,
  workspaceItemsTotal,
  workspaceSubtitle,
} from "@/components/workspaces/workspaces-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreads } from "@/hooks/use-threads";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { rankWorkspacesByRecency } from "@/lib/recent-workspaces";
import { useAppUi } from "@/lib/store";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import type { WorkspaceDto } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

export function HomeRecent({ limit = 3 }: { limit?: number }) {
  const { workspaces, loading, error, load } = useWorkspaces();
  const { threads } = useThreads();
  const items = rankWorkspacesByRecency(workspaces, threads).slice(0, limit);
  const previewByWs = new Map<string, string>();
  for (const t of threads) {
    if (!t.projectId || previewByWs.has(t.projectId)) continue;
    if (t.lastMessage?.content) previewByWs.set(t.projectId, t.lastMessage.content);
  }
  const showSkeleton = loading && items.length === 0;
  const showError = error && !loading && items.length === 0;

  return (
    <section aria-label="Продолжить работу" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Продолжить работу</h2>
        <p className="text-[11px] text-muted-foreground">недавние воркспейсы</p>
      </div>

      {showSkeleton ? (
        <HomeRecentSkeleton />
      ) : showError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed px-4 py-5">
          <p className="text-sm text-muted-foreground">
            Не удалось загрузить недавние воркспейсы.
          </p>
          <Button variant="outline" size="sm" onClick={load}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Повторить
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">
          Пока нет картин. Создайте фильм — книга и трек могут идти рядом.
        </p>
      ) : (
        <>
          {/* Сетка вертикальных карточек (sm+) */}
          <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-3">
            {items.map((ws) => (
              <GridCard key={ws.id} ws={ws} preview={previewByWs.get(ws.id)} />
            ))}
          </div>

          {/* Компактные строки (мобайл / узкий экран) */}
          <div className="grid gap-2 sm:hidden">
            {items.map((ws) => (
              <CompactCard key={ws.id} ws={ws} preview={previewByWs.get(ws.id)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Скелетоны обеих компоновок на время загрузки списка. */
function HomeRecentSkeleton() {
  return (
    <div role="status" aria-label="Загрузка недавних воркспейсов">
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-xl border bg-card"
          >
            <Skeleton className="h-20 w-full rounded-none" />
            <div className="space-y-2 p-3.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:hidden">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Вертикальная карточка с баннером (сетка дашборда) ── */

function GridCard({ ws, preview }: { ws: WorkspaceDto; preview?: string }) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const meta = WORKSPACE_TYPE_META[ws.type];
  const total = workspaceItemsTotal(ws);

  return (
    <button
      type="button"
      onClick={() => openWorkspace(ws.id)}
      title={`Открыть воркспейс «${ws.name}»`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      {/* Баннер с градиентом типа */}
      <span
        className={cn(
          "relative flex h-20 items-center justify-center bg-gradient-to-br",
          meta.gradient,
        )}
        aria-hidden="true"
      >
        <meta.icon className="size-8 text-white/95 drop-shadow-sm transition-transform duration-300 group-hover:scale-110" />
        <span className="absolute right-2 top-2">
          <Badge
            variant="outline"
            className="border-white/30 bg-black/25 px-2 py-0 text-[10px] text-white backdrop-blur-sm"
          >
            {stageLabelOf(ws)}
          </Badge>
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {ws.name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {preview || workspaceSubtitle(ws)}
            </span>
          </span>
          <ArrowUpRight
            className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </span>

        <span className="mt-auto space-y-1.5">
          <span
            className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={ws.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Прогресс воркспейса «${ws.name}»`}
          >
            <span
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: `${ws.progress}%` }}
            />
          </span>
          <span className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span title={meta.hint}>
              {meta.label} · {total}{" "}
              {pluralRu(total, "объект", "объекта", "объектов")}
            </span>
            <span className="font-medium tabular-nums text-foreground/80">
              {ws.progress}%
            </span>
          </span>
          <span className="block text-[11px] text-muted-foreground">
            обновлён {timeAgo(ws.updatedAt)}
          </span>
        </span>
      </span>
    </button>
  );
}

/* ── Компактная горизонтальная строка (мобайл) ── */

function CompactCard({ ws, preview }: { ws: WorkspaceDto; preview?: string }) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const meta = WORKSPACE_TYPE_META[ws.type];
  const total = workspaceItemsTotal(ws);

  return (
    <button
      type="button"
      onClick={() => openWorkspace(ws.id)}
      title={`Открыть воркспейс «${ws.name}»`}
      className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          meta.gradient,
        )}
        aria-hidden="true"
      >
        <meta.icon className="size-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{ws.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {preview || `${meta.label} · ${total} ${pluralRu(total, "объект", "объекта", "объектов")}`}
          {" · "}
          {timeAgo(ws.updatedAt)}
        </span>
        <span
          className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={ws.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Прогресс воркспейса «${ws.name}»`}
        >
          <span
            className="block h-full rounded-full bg-primary transition-all"
            style={{ width: `${ws.progress}%` }}
          />
        </span>
      </span>

      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {ws.progress}%
      </span>
    </button>
  );
}
