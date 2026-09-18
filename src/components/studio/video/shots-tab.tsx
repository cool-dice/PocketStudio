"use client";

import { cn } from "@/lib/utils";

import { StatusChip, type ChipTone } from "./status-chip";
import {
  SHOTS,
  SHOT_STATUS_LABEL,
  type ShotStatus,
} from "./video-data";

const PLAN_CHIP: Record<string, string> = {
  Общий: "border-border bg-muted text-muted-foreground",
  Средний:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
  Крупный: "border-primary/40 bg-primary/15 text-primary",
  Деталь:
    "border-stone-400/40 bg-stone-400/10 text-stone-600 dark:border-stone-500/40 dark:bg-stone-500/10 dark:text-stone-300",
};

const SHOT_TONE: Record<ShotStatus, ChipTone> = {
  ready: "done",
  render: "active",
  draft: "pending",
};

/**
 * Таб «Кадры»: раскадровка активной сцены — тип плана, движение
 * камеры, длительность и статус каждого кадра.
 */
export function ShotsTab() {
  const total = SHOTS.reduce((acc, s) => acc + s.duration, 0);

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Кадры сцены
        </h3>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {SHOTS.length} кадров · {total}с
        </span>
      </header>

      <ul className="space-y-1.5">
        {SHOTS.map((shot) => (
          <li
            key={shot.id}
            title={shot.camera}
            className="grid grid-cols-[1.75rem_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border bg-card px-2.5 py-2"
          >
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              #{shot.id}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                PLAN_CHIP[shot.plan],
              )}
            >
              {shot.plan}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {shot.camera}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {shot.duration}с
              </span>
              <StatusChip
                tone={SHOT_TONE[shot.status]}
                label={SHOT_STATUS_LABEL[shot.status]}
              />
            </span>
          </li>
        ))}
      </ul>

      <p className="px-0.5 text-[11px] leading-relaxed text-muted-foreground">
        Порядок кадров можно менять перетаскиванием — подключим вместе
        с движком рендера.
      </p>
    </div>
  );
}
