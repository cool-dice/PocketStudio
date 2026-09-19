"use client";

/**
 * NoteGrid — пиано-ролл синт-дорожки (бас/лид/пэд): 13 строк октавы ×
 * шаги, клик = поставить/снять ноту {step, midi = octave·12 + row}.
 * Здесь же селектор волны (синус/меандр/пила/треуг) и октавы 1..6.
 * Колонка текущего шага подсвечивается при воспроизведении.
 */

import { useMemo } from "react";
import { Square, Triangle, Waves, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { midiLabelRu, type SynthNote, type Waveform } from "@/lib/daw-model";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const WAVEFORM_OPTIONS: ReadonlyArray<{ value: Waveform; label: string; icon: typeof Waves }> = [
  { value: "sine", label: "Синус", icon: Waves },
  { value: "square", label: "Меандр", icon: Square },
  { value: "sawtooth", label: "Пила", icon: Zap },
  { value: "triangle", label: "Треуг", icon: Triangle },
];

export const OCTAVES: readonly number[] = [1, 2, 3, 4, 5, 6];

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);
const ROWS: readonly number[] = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

function cellMargin(step: number): string {
  if (step > 0 && step % 16 === 0) return "ml-2.5";
  if (step > 0 && step % 4 === 0) return "ml-1";
  return "";
}

export function NoteGrid({
  notes,
  waveform,
  octave,
  totalSteps,
  currentStep,
  accentClass,
  onToggleNote,
  onWaveformChange,
  onOctaveChange,
}: {
  notes: SynthNote[];
  waveform: Waveform;
  octave: number;
  totalSteps: number;
  /** Индекс играющего шага или −1, если стоит на паузе. */
  currentStep: number;
  /** Класс активной ноты (цвет дорожки: emerald/violet/teal). */
  accentClass: string;
  onToggleNote: (step: number, midi: number) => void;
  onWaveformChange: (waveform: Waveform) => void;
  onOctaveChange: (octave: number) => void;
}) {
  const active = useMemo(
    () => new Set(notes.map((n) => `${n.step}:${n.midi}`)),
    [notes],
  );

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Волна</span>
          <ToggleGroup
            type="single"
            value={waveform}
            onValueChange={(v) => {
              if (v) onWaveformChange(v as Waveform);
            }}
            variant="outline"
            size="sm"
            aria-label="Форма волны"
          >
            {WAVEFORM_OPTIONS.map((w) => (
              <ToggleGroupItem key={w.value} value={w.value} className="gap-1.5 px-2 text-xs">
                <w.icon className="size-3.5" aria-hidden="true" />
                {w.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <label className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Октава</span>
          <Select
            value={String(octave)}
            onValueChange={(v) => onOctaveChange(Number(v))}
          >
            <SelectTrigger size="sm" className="w-[4.5rem]" aria-label="Октава">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OCTAVES.map((o) => (
                <SelectItem key={o} value={String(o)}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="vf-scroll-x overflow-x-auto pb-1" role="group" aria-label="Ноты дорожки">
        <div className="w-max space-y-0.5">
          {ROWS.map((row) => {
            const midi = octave * 12 + row;
            const black = BLACK_KEYS.has(((midi % 12) + 12) % 12);
            return (
              <div key={row} className="flex items-center gap-2">
                <span
                  className={cn(
                    "w-14 shrink-0 text-right text-[10px] font-medium tabular-nums",
                    black ? "text-muted-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {midiLabelRu(midi)}
                </span>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalSteps }, (_, step) => {
                    const on = active.has(`${step}:${midi}`);
                    const playing = step === currentStep;
                    return (
                      <button
                        key={step}
                        type="button"
                        aria-pressed={on}
                        aria-label={`Нота ${midiLabelRu(midi)}, шаг ${step + 1}`}
                        onClick={() => onToggleNote(step, midi)}
                        className={cn(
                          "size-5 min-w-5 shrink-0 rounded-[5px] border transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          cellMargin(step),
                          on
                            ? cn("border-transparent shadow-[inset_0_1px_2px_rgba(0,0,0,0.25)]", accentClass)
                            : black
                              ? "border-transparent bg-muted/40 hover:bg-muted/70"
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
    </div>
  );
}
