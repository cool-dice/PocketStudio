"use client";

/**
 * DrumGrid — степ-секвенсор барабанной дорожки: 5 инструментов × шаги.
 * Каждые 4 шага — визуальная группа, каждые 16 — граница такта;
 * колонка текущего шага подсвечивается при воспроизведении.
 * Мобильная раскладка — горизонтальный скролл (vf-scroll-x).
 */

import { cn } from "@/lib/utils";
import {
  DRUM_INSTRUMENTS,
  DRUM_LABELS,
  type DrumInstrument,
  type DrumPattern,
} from "@/lib/daw-model";

function cellMargin(step: number): string {
  if (step > 0 && step % 16 === 0) return "ml-3";
  if (step > 0 && step % 4 === 0) return "ml-1.5";
  return "";
}

export function DrumGrid({
  pattern,
  totalSteps,
  currentStep,
  onToggle,
}: {
  pattern: DrumPattern;
  totalSteps: number;
  /** Индекс играющего шага или −1, если стоит на паузе. */
  currentStep: number;
  onToggle: (instrument: DrumInstrument, step: number) => void;
}) {
  return (
    <div
      className="vf-scroll-x overflow-x-auto pb-1"
      role="group"
      aria-label="Паттерн барабанов"
    >
      <div className="w-max space-y-1">
        {DRUM_INSTRUMENTS.map((instrument) => {
          const row = pattern[instrument] ?? [];
          return (
            <div key={instrument} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                {DRUM_LABELS[instrument]}
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalSteps }, (_, step) => {
                  const on = row[step] === true;
                  const playing = step === currentStep;
                  return (
                    <button
                      key={step}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${DRUM_LABELS[instrument]}, шаг ${step + 1}`}
                      onClick={() => onToggle(instrument, step)}
                      className={cn(
                        "size-6 min-w-6 shrink-0 rounded-md border transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        cellMargin(step),
                        on
                          ? "border-amber-600/60 bg-amber-500 shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]"
                          : "border-transparent bg-muted/60 hover:bg-muted",
                        playing && "ring-1 ring-emerald-400/80",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
