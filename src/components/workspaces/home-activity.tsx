"use client";

/**
 * HomeActivity — лента «Активность» на Главной (PS-3-a → PS-4):
 * события всех воркспейсов с тип-окрашенными иконками; клик по событию
 * открывает воркспейс, в котором оно произошло. Карточка растягивается
 * по высоте соседнего чат-виджета, список скроллится внутри.
 */

import { ChevronRight } from "lucide-react";

import {
  ACTIVITY_TONE_CLASS,
  HOME_ACTIVITY,
} from "@/components/workspaces/home-data";
import { useAppUi } from "@/lib/store";
import { findWorkspace } from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

export function HomeActivity() {
  const openWorkspace = useAppUi((s) => s.openWorkspace);

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

      <ul className="vf-scroll min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto p-2">
        {HOME_ACTIVITY.map((item) => {
          const workspace = findWorkspace(item.workspaceId);
          if (!workspace) return null;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openWorkspace(item.workspaceId)}
                title={`Открыть «${workspace.title}»`}
                className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    ACTIVITY_TONE_CLASS[item.tone],
                  )}
                  aria-hidden="true"
                >
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.text}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                    {item.time} · {workspace.title}
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
    </section>
  );
}
