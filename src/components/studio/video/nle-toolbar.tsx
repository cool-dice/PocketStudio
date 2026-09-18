"use client";

/**
 * Программный тулбар вкладки «Монтаж»: «Собрать фильм», индикатор
 * хронометража (14:32 / цель 10–20 мин + перспектива до 2 ч),
 * магнитная привязка и зум таймлайна.
 */

import { Film, Hourglass, Magnet, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { StatusChip } from "./status-chip";
import {
  formatDur,
  PERSPECTIVE,
  PPS_LABELS,
  TARGET_RANGE,
} from "./nle-data";

export function NleToolbar({
  filmSeconds,
  assembled,
  onAssemble,
  snapping,
  onSnappingChange,
  zoom,
  onZoomChange,
}: {
  filmSeconds: number;
  assembled: boolean;
  onAssemble: () => void;
  snapping: boolean;
  onSnappingChange: (on: boolean) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border bg-card p-3">
      {/* Сборка */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button size="sm" onClick={onAssemble} className="gap-1.5">
          <Film aria-hidden="true" />
          Собрать фильм
        </Button>
        {assembled ? <StatusChip tone="done" label="Сборка завершена" /> : null}
      </div>

      {/* Хронометраж */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="font-mono text-sm font-semibold tabular-nums leading-none">
          {formatDur(filmSeconds)}
          <span className="ml-1.5 font-sans text-[11px] font-normal text-muted-foreground">
            / цель {TARGET_RANGE}
          </span>
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
          <Hourglass className="size-3" aria-hidden="true" />
          Перспектива: {PERSPECTIVE}
        </span>
      </div>

      {/* Магнит + зум */}
      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Magnet
            className={cn("size-4", snapping && "text-primary")}
            aria-hidden="true"
          />
          Магнит
          <Switch
            checked={snapping}
            onCheckedChange={onSnappingChange}
            aria-label="Магнитная привязка клипов"
          />
        </label>

        <div className="flex items-center gap-1" role="group" aria-label="Масштаб таймлайна">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onZoomChange(Math.max(0, zoom - 1))}
            disabled={zoom === 0}
            aria-label="Уменьшить масштаб таймлайна"
          >
            <ZoomOut aria-hidden="true" />
          </Button>
          <span className="w-12 text-center font-mono text-[11px] tabular-nums text-muted-foreground">
            {PPS_LABELS[zoom]}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onZoomChange(Math.min(PPS_LABELS.length - 1, zoom + 1))}
            disabled={zoom === PPS_LABELS.length - 1}
            aria-label="Увеличить масштаб таймлайна"
          >
            <ZoomIn aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
