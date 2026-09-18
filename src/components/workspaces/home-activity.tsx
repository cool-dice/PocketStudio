"use client";

/**
 * HomeActivity — лента «Активность» на Главной (Фаза A):
 * живые события из /api/dashboard (передаются из HomeScreen).
 * Иконка — по типу артефакта, тональность и название воркспейса —
 * из кэша списка useWorkspaces; клик открывает воркспейс события.
 * Карточка растягивается по высоте соседнего чат-виджета.
 */

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";

import {
  ACTIVITY_TONE_CLASS,
  activityIconOf,
  type ActivityTone,
} from "@/components/workspaces/home-data";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useAppUi } from "@/lib/store";
import type { DashboardActivityItem } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

export function HomeActivity({
  items,
  loading = false,
}: {
  items: DashboardActivityItem[];
  loading?: boolean;
}) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const { workspaces } = useWorkspaces();

  /** id → воркспейс: имя и тип для подписи события. */
  const byId = useMemo(
    () => new Map(workspaces.map((ws) => [ws.id, ws])),
    [workspaces],
  );

  return (
    <section
      aria-label="Активность студии"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Активность</h2>
        <p className="truncate text-[11px] text-muted-foreground">
          по всем воркспейсам
        </p>
      </div>

      {loading ? (
        <ul
          className="vf-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
          role="status"
          aria-label="Загрузка ленты активности"
        >
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 px-1">
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 p-6 text-center">
          <p className="text-sm font-medium">Пока тихо</p>
          <p className="text-xs text-muted-foreground">
            Здесь появятся новые артефакты из всех воркспейсов.
          </p>
        </div>
      ) : (
        <ul className="vf-scroll min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto p-2">
          {items.map((item) => {
            const workspace = byId.get(item.workspaceId);
            const Icon = activityIconOf(item.type);
            const tone: ActivityTone = workspace ? workspace.type : "neutral";
            const workspaceName = workspace?.name ?? "воркспейс";
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openWorkspace(item.workspaceId)}
                  title={`Открыть «${workspaceName}»`}
                  className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-lg",
                      ACTIVITY_TONE_CLASS[tone],
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{item.text}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {item.time} · {workspaceName}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
