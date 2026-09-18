"use client";

import { useRef, useState } from "react";
import { ChevronDown, Pause, Play, SlidersHorizontal, Square, Timer, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * Транспорт DAW: воспроизведение/стоп, позиция «Такт N.B»,
 * BPM с tap-темпом, метроном, мастер-громкость, микшер и экспорт.
 */
export function TransportBar({
  playing,
  playhead,
  bpm,
  metronome,
  masterVolume,
  mixerOpen,
  onTogglePlay,
  onStop,
  onBpmChange,
  onMetronomeChange,
  onMasterVolumeChange,
  onToggleMixer,
}: {
  playing: boolean;
  playhead: number;
  bpm: number;
  metronome: boolean;
  masterVolume: number;
  mixerOpen: boolean;
  onTogglePlay: () => void;
  onStop: () => void;
  onBpmChange: (v: number) => void;
  onMetronomeChange: (v: boolean) => void;
  onMasterVolumeChange: (v: number) => void;
  onToggleMixer: () => void;
}) {
  const [tapCount, setTapCount] = useState(0);
  const tapsRef = useRef<number[]>([]);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bar = Math.floor(playhead) + 1;
  const beat = Math.floor((playhead % 1) * 4) + 1;
  const activeBeat = Math.floor((playhead % 1) * 4);

  /** Tap-темпо: считаем средний интервал между нажатиями. */
  const handleTap = () => {
    const now = Date.now();
    const taps = tapsRef.current.filter((t) => now - t < 2400);
    taps.push(now);
    tapsRef.current = taps.slice(-8);
    setTapCount(tapsRef.current.length);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setTapCount(0), 2400);
    if (tapsRef.current.length >= 2) {
      const intervals = tapsRef.current.slice(1).map((t, i) => t - tapsRef.current[i]!);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const detected = Math.round(60000 / avg);
      onBpmChange(Math.max(40, Math.min(240, detected)));
    }
  };

  return (
    <section
      aria-label="Транспорт студии"
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3 py-2 shadow-sm"
    >
      {/* Воспроизведение / стоп */}
      <div className="flex items-center gap-1.5">
        <Button
          size="icon"
          className="size-9 rounded-full"
          onClick={onTogglePlay}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
        >
          {playing ? (
            <Pause className="size-4" aria-hidden="true" />
          ) : (
            <Play className="size-4 translate-x-px" aria-hidden="true" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={onStop}
          aria-label="Стоп и возврат к началу"
        >
          <Square className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Позиция + метр */}
      <div className="flex items-center gap-2">
        <span
          className="rounded-md border bg-muted/50 px-2 py-1 font-mono text-xs font-medium tabular-nums"
          aria-live="off"
        >
          Такт {bar}.{beat}
        </span>
        <span className="font-mono text-xs text-muted-foreground" aria-hidden="true">
          4/4
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 rounded-full transition-all duration-150",
                playing && activeBeat === i
                  ? metronome
                    ? "scale-150 bg-amber-500"
                    : "scale-150 bg-primary"
                  : "bg-muted-foreground/30",
              )}
            />
          ))}
        </span>
      </div>

      {/* BPM + tap */}
      <div className="flex items-center gap-1.5">
        <label htmlFor="daw-bpm" className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          BPM
        </label>
        <Input
          id="daw-bpm"
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={(e) => {
            const v = Number.parseInt(e.target.value, 10);
            if (Number.isFinite(v)) onBpmChange(Math.max(40, Math.min(240, v)));
          }}
          className="h-8 w-14 border-input bg-background text-center font-mono text-xs tabular-nums"
          aria-label="Темп проекта"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 font-mono text-[11px]"
          onClick={handleTap}
          aria-label="Tap-темп — нажимайте в ритме"
        >
          <Timer className="size-3.5" aria-hidden="true" />
          {tapCount > 0 ? `TAP ${tapCount}` : "TAP"}
        </Button>
        <span className="hidden font-mono text-[10px] text-muted-foreground xl:inline" aria-hidden="true">
          {`такт ≈ ${(240 / bpm).toFixed(1).replace(".", ",")} с`}
        </span>
      </div>

      {/* Метроном */}
      <div className="flex items-center gap-2">
        <Switch
          id="daw-metronome"
          checked={metronome}
          onCheckedChange={onMetronomeChange}
          aria-label="Метроном"
        />
        <label
          htmlFor="daw-metronome"
          className="cursor-pointer text-xs text-muted-foreground select-none"
        >
          Метроном
        </label>
      </div>

      {/* Мастер-громкость */}
      <div className="flex min-w-40 items-center gap-2">
        <Volume2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <Slider
          min={0}
          max={100}
          step={1}
          value={[masterVolume]}
          onValueChange={([v]) => onMasterVolumeChange(v)}
          className="flex-1"
          aria-label="Мастер-громкость"
        />
        <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {masterVolume}%
        </span>
      </div>

      {/* Микшер + экспорт */}
      <div className="ml-auto flex items-center gap-2">
        <Button
          variant={mixerOpen ? "secondary" : "outline"}
          size="sm"
          className="h-8 gap-1"
          onClick={onToggleMixer}
          aria-expanded={mixerOpen}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Микшер
          <ChevronDown
            className={cn("size-3.5 transition-transform", mixerOpen && "rotate-180")}
            aria-hidden="true"
          />
        </Button>
        <span className="relative">
          <Button
            size="sm"
            className="h-8"
            onClick={() =>
              toast("Экспорт микса — визуальный макет", {
                description: "Сведение дорожек и рендер WAV/MP3 подключаются на следующем этапе.",
              })
            }
          >
            Экспорт микса
          </Button>
          <span
            className="absolute -top-2 -right-2 rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold text-amber-700 dark:text-amber-400"
            aria-hidden="true"
          >
            В разработке
          </span>
        </span>
      </div>
    </section>
  );
}
