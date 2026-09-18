"use client";

/**
 * HomeRecent — «Продолжить работу» на Главной (PS-3-a → PS-4):
 * недавние воркспейсы карточками. `variant="grid"` — вертикальная
 * карточка с градиентным баннером для сетки дашборда (md+),
 * `variant="compact"` — горизонтальная компактная строка (мобайл).
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
  const items = MOCK_WORKSPACES.slice(0, limit);

  return (
    <section aria-label="Продолжить работу" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Продолжить работу</h2>
        <p className="text-[11px] text-muted-foreground">недавние воркспейсы</p>
      </div>

      {/* Сетка вертикальных карточек (md+) */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-3">
        {items.map((ws) => (
          <GridCard key={ws.id} ws={ws} />
        ))}
      </div>

      {/* Компактные строки (мобайл / узкий экран) */}
      <div className="grid gap-2 sm:hidden">
        {items.map((ws) => (
          <CompactCard key={ws.id} ws={ws} />
        ))}
      </div>
    </section>
  );
}

/* ── Вертикальная карточка с баннером (сетка дашборда) ── */

function GridCard({ ws }: { ws: WorkspaceSummary }) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const meta = WORKSPACE_TYPE_META[ws.type];
  const artifactCount = artifactsOfWorkspace(ws.id).length;

  return (
    <button
      type="button"
      onClick={() => openWorkspace(ws.id)}
      title={`Открыть воркспейс «${ws.title}»`}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      {/* Баннер с градиентом типа */}
      <span
        className={cn(
          "relative flex h-20 items-center justify-center bg-gradient-to-br",
          ws.gradient,
        )}
        aria-hidden="true"
      >
        <meta.icon className="size-8 text-white/95 drop-shadow-sm transition-transform duration-300 group-hover:scale-110" />
        <span className="absolute right-2 top-2">
          <Badge
            variant="outline"
            className="border-white/30 bg-black/25 px-2 py-0 text-[10px] text-white backdrop-blur-sm"
          >
            {ws.stage}
          </Badge>
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
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

        <span className="mt-auto space-y-1.5">
          <span
            className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
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
          <span className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span title={meta.hint}>{meta.label} · {pluralArtifacts(artifactCount)}</span>
            <span className="font-medium tabular-nums text-foreground/80">
              {ws.progress}%
            </span>
          </span>
          <span className="block text-[11px] text-muted-foreground">
            обновлён {ws.updatedAgo}
          </span>
        </span>
      </span>
    </button>
  );
}

/* ── Компактная горизонтальная строка (мобайл) ── */

function CompactCard({ ws }: { ws: WorkspaceSummary }) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const meta = WORKSPACE_TYPE_META[ws.type];
  const artifactCount = artifactsOfWorkspace(ws.id).length;

  return (
    <button
      type="button"
      onClick={() => openWorkspace(ws.id)}
      title={`Открыть воркспейс «${ws.title}»`}
      className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm",
          ws.gradient,
        )}
        aria-hidden="true"
      >
        <meta.icon className="size-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{ws.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {meta.label} · {pluralArtifacts(artifactCount)} · {ws.updatedAgo}
        </span>
        <span
          className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted"
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
      </span>

      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
        {ws.progress}%
      </span>
    </button>
  );
}
