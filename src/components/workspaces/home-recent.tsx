"use client";

/**
 * HomeRecent — «Продолжить работу» на Главной (PS-3-a): недавние
 * воркспейсы богатыми карточками (градиентная плитка типа, бейджи типа
 * и стадии, прогресс, счётчик артефактов, обновление) с hover-подъёмом.
 */

import { ArrowUpRight } from "lucide-react";

import { pluralArtifacts } from "@/components/workspaces/overview-data";
import { artifactsOfWorkspace } from "@/components/workspaces/shared/artifacts-data";
import { Badge } from "@/components/ui/badge";
import { useAppUi } from "@/lib/store";
import {
  MOCK_WORKSPACES,
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

export function HomeRecent({ limit = 3 }: { limit?: number }) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const items = MOCK_WORKSPACES.slice(0, limit);

  return (
    <section aria-label="Продолжить работу" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Продолжить работу</h2>
        <p className="text-xs text-muted-foreground">недавние воркспейсы</p>
      </div>

      <div className="grid gap-3">
        {items.map((ws) => (
          <RecentCard key={ws.id} ws={ws} onOpen={() => openWorkspace(ws.id)} />
        ))}
      </div>
    </section>
  );
}

function RecentCard({ ws, onOpen }: { ws: WorkspaceSummary; onOpen: () => void }) {
  const meta = WORKSPACE_TYPE_META[ws.type];
  const artifactCount = artifactsOfWorkspace(ws.id).length;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Открыть воркспейс «${ws.title}»`}
      className="group flex w-full items-start gap-3.5 rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm sm:size-14",
          ws.gradient,
        )}
        aria-hidden="true"
      >
        <meta.icon className="size-6 sm:size-7" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold sm:text-base">
              {ws.title}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {ws.subtitle}
            </span>
          </span>
          <ArrowUpRight
            className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </span>

        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            title={meta.hint}
            className="px-2 py-0 text-[10px]"
          >
            {meta.label}
          </Badge>
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 px-2 py-0 text-[10px] text-emerald-700 dark:text-emerald-400"
          >
            {ws.stage}
          </Badge>
          <span className="ml-auto text-[11px] font-semibold tabular-nums text-muted-foreground">
            {ws.progress}%
          </span>
        </span>

        <span
          className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={ws.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Прогресс воркспейса «${ws.title}»`}
        >
          <span
            className="block h-full rounded-full bg-primary transition-all"
            style={{ width: `${ws.progress}%` }}
          />
        </span>

        <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span>{pluralArtifacts(artifactCount)}</span>
          <span>обновлён {ws.updatedAgo}</span>
        </span>
      </span>
    </button>
  );
}
