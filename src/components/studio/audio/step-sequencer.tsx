"use client";

import { useState } from "react";
import { ChevronDown, Drum, Pause, Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SelectableChip } from "./chip";
import { cn } from "@/lib/utils";
import { BEAT_PRESETS, BEAT_ROW_COLORS, BEAT_ROW_NAMES, type BeatPreset } from "./daw-data";

/**
 * Секвенсор бита: сетка 4×16 шагов с подсветкой активного шага
 * (синхронизирована с плейхедом) и пресетами паттернов.
 */
export function StepSequencer({
  pattern,
  activeStep,
  playing,
  activePresetId,
  onTogglePlay,
  onStop,
  onToggleCell,
  onLoadPreset,
}: {
  pattern: boolean[][];
  activeStep: number;
  playing: boolean;
  activePresetId: string | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onToggleCell: (row: number, step: number) => void;
  onLoadPreset: (preset: BeatPreset) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <section aria-label="Секвенсор бита" className="shrink-0 rounded-xl border bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Drum className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Секвенсор бита</h3>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">16 шагов · 1 такт</span>

        <div className="ml-auto flex items-center gap-1.5">
          {BEAT_PRESETS.map((p) => (
            <SelectableChip
              key={p.id}
              label={p.name}
              selected={activePresetId === p.id}
              onClick={() => onLoadPreset(p)}
              className="px-2.5 py-1 text-[11px]"
            />
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={onTogglePlay}
            aria-label={playing ? "Пауза бита" : "Проиграть бит"}
          >
            {playing ? (
              <Pause className="size-3.5" aria-hidden="true" />
            ) : (
              <Play className="size-3.5" aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={onStop}
            aria-label="Остановить бит"
          >
            <Square className="size-3" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? "Свернуть секвенсор" : "Развернуть секвенсор"}
          >
            <ChevronDown className={cn("size-4 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
          </Button>
        </div>
      </header>

      {open ? (
        <div className="vf-scroll overflow-x-auto border-t px-3 py-2.5">
          <div className="min-w-max space-y-1.5">
            {pattern.map((row, ri) => (
              <div key={ri} className="flex items-center gap-2">
                <span className="w-11 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                  {BEAT_ROW_NAMES[ri]}
                </span>
                <div className="flex gap-[3px]">
                  {row.map((on, si) => (
                    <button
                      key={si}
                      type="button"
                      onClick={() => onToggleCell(ri, si)}
                      aria-pressed={on}
                      aria-label={`${BEAT_ROW_NAMES[ri]}, шаг ${si + 1}`}
                      className={cn(
                        "size-6 shrink-0 rounded-[5px] border transition-all active:scale-90 sm:size-7",
                        si > 0 && si % 4 === 0 && "ml-2",
                        activeStep === si
                          ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
                          : "ring-1 ring-transparent",
                        on
                          ? "border-transparent shadow-sm"
                          : "border-border bg-muted/50 hover:bg-accent",
                      )}
                      style={
                        on
                          ? {
                              backgroundColor: `${BEAT_ROW_COLORS[ri]}2e`,
                              borderColor: `${BEAT_ROW_COLORS[ri]}aa`,
                            }
                          : undefined
                      }
                    >
                      {on ? (
                        <span
                          className="mx-auto block size-2 rounded-full sm:size-2.5"
                          style={{ backgroundColor: BEAT_ROW_COLORS[ri] }}
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
