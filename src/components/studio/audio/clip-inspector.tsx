"use client";

import { Copy, Minus, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { semitoneLabel, type DawClip, type DawTrackState } from "./daw-data";

/**
 * Плавающий инспектор выбранного клипа: метаданные
 * и операции (дублирование, транспонирование, удаление).
 */
export function ClipInspector({
  clip,
  track,
  onClose,
  onDuplicate,
  onTranspose,
  onDelete,
}: {
  clip: DawClip;
  track: DawTrackState;
  onClose: () => void;
  onDuplicate: () => void;
  onTranspose: (delta: number) => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-label={`Инспектор клипа «${clip.name}»`}
      className="absolute right-2 top-9 z-50 w-60 rounded-xl border bg-card p-3 shadow-xl"
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 size-2.5 shrink-0 rounded-full"
          style={{ background: track.color }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={clip.name}>
            {clip.name}
          </p>
          <p className="text-[10px] text-muted-foreground">Дорожка «{track.name}»</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground"
          onClick={onClose}
          aria-label="Закрыть инспектор"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-muted/40 p-2 text-xs">
        <div>
          <dt className="text-[10px] text-muted-foreground">Тональность</dt>
          <dd className="font-mono font-medium tabular-nums">{clip.key}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">BPM</dt>
          <dd className="font-mono font-medium tabular-nums">{clip.bpm}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">Длина</dt>
          <dd className="font-mono font-medium tabular-nums">
            {clip.lengthBars} такт{clip.lengthBars === 1 ? "" : "ов"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted-foreground">Позиция</dt>
          <dd className="font-mono font-medium tabular-nums">такт {clip.startBar + 1}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-start"
          onClick={onDuplicate}
        >
          <Copy className="size-3.5" aria-hidden="true" />
          Дублировать
        </Button>
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Транспонировать
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => onTranspose(-1)}
            aria-label="Транспонировать на полтона вниз"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </Button>
          <span className="min-w-12 text-center font-mono text-xs font-medium tabular-nums">
            {semitoneLabel(clip.transpose)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => onTranspose(1)}
            aria-label="Транспонировать на полтона вверх"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full justify-start text-rose-600 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-400"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Удалить клип
        </Button>
      </div>
    </div>
  );
}
