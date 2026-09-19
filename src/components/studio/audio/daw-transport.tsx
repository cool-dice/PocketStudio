"use client";

/**
 * DawTransport — панель транспорта студии (sticky): Play/Stop, позиция,
 * индикатор автосохранения, BPM-степпер, такты, транспонирование,
 * метроном, мастер-громкость и экспорт микса.
 */

import { Check, Loader2, Minus, Play, Plus, Square, Timer } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

const BARS_OPTIONS: readonly number[] = [1, 2, 4, 8];
const TRANSPOSE_OPTIONS: readonly number[] = Array.from({ length: 25 }, (_, i) => i - 12);

export function DawTransport({
  playing,
  saveStatus,
  position,
  exporting,
  bpm,
  bars,
  transpose,
  metronome,
  masterVolume,
  onTogglePlay,
  onBpmStep,
  onBarsChange,
  onTransposeChange,
  onMetronomeChange,
  onMasterVolumeChange,
  onExport,
}: {
  playing: boolean;
  saveStatus: SaveStatus;
  position: { bar: number; beat: number; step: number; total: number };
  exporting: boolean;
  bpm: number;
  bars: number;
  transpose: number;
  metronome: boolean;
  masterVolume: number;
  onTogglePlay: () => void;
  onBpmStep: (delta: number) => void;
  onBarsChange: (bars: number) => void;
  onTransposeChange: (transpose: number) => void;
  onMetronomeChange: (enabled: boolean) => void;
  onMasterVolumeChange: (volume: number) => void;
  onExport: () => void;
}) {
  return (
    <section
      className="sticky top-0 z-10 rounded-xl border bg-card/95 p-3 shadow-sm backdrop-blur"
      aria-label="Транспорт студии"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          size="icon"
          className="size-11 shrink-0 rounded-full"
          onClick={onTogglePlay}
          aria-label={playing ? "Остановить" : "Слушать проект"}
        >
          {playing ? (
            <Square className="size-4" fill="currentColor" aria-hidden="true" />
          ) : (
            <Play className="size-5 translate-x-px" fill="currentColor" aria-hidden="true" />
          )}
        </Button>
        <div className="min-w-0">
          <p className="text-xs font-medium tabular-nums">
            Такт {position.bar}.{position.beat} · шаг {position.step + 1}/{position.total}
          </p>
          <p
            className={cn(
              "mt-0.5 flex items-center gap-1 text-[11px]",
              saveStatus === "saved" && "text-emerald-600 dark:text-emerald-400",
              saveStatus === "error" && "text-rose-600 dark:text-rose-400",
              saveStatus !== "saved" && saveStatus !== "error" && "text-muted-foreground",
            )}
            role="status"
          >
            {saveStatus === "saving" ? "Сохраняем…" : null}
            {saveStatus === "saved" ? (
              <>
                <Check className="size-3" aria-hidden="true" />
                Сохранено
              </>
            ) : null}
            {saveStatus === "error" ? "Не сохранилось" : null}
            {saveStatus === "idle" ? "—" : null}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto shrink-0"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Timer className="size-4" aria-hidden="true" />
          )}
          {exporting ? "Рендерим…" : "Экспорт микса"}
        </Button>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2.5">
        <div className="flex items-center gap-1" role="group" aria-label="Темп">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onBpmStep(-1)}
            aria-label="Медленнее"
          >
            <Minus className="size-3.5" aria-hidden="true" />
          </Button>
          <span className="w-16 text-center text-sm font-semibold tabular-nums">
            {bpm}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">BPM</span>
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onBpmStep(1)}
            aria-label="Быстрее"
          >
            <Plus className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Такты</span>
          <Select value={String(bars)} onValueChange={(v) => onBarsChange(Number(v))}>
            <SelectTrigger size="sm" className="w-[4.25rem]" aria-label="Число тактов">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BARS_OPTIONS.map((b) => (
                <SelectItem key={b} value={String(b)}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Тон</span>
          <Select value={String(transpose)} onValueChange={(v) => onTransposeChange(Number(v))}>
            <SelectTrigger size="sm" className="w-[5rem]" aria-label="Транспонирование">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSPOSE_OPTIONS.map((t) => (
                <SelectItem key={t} value={String(t)}>
                  {t > 0 ? `+${t}` : t} пт
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <Toggle
          variant="outline"
          size="sm"
          pressed={metronome}
          onPressedChange={onMetronomeChange}
          aria-label="Метроном"
        >
          <Timer className="size-3.5" aria-hidden="true" />
          Метроном
        </Toggle>

        <div className="flex min-w-40 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Мастер</span>
          <Slider
            min={0}
            max={1}
            step={0.05}
            value={[masterVolume]}
            onValueChange={([v]) => onMasterVolumeChange(v)}
            className="min-w-16 flex-1"
            aria-label="Мастер-громкость"
          />
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
      </div>
    </section>
  );
}
