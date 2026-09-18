"use client";

/**
 * ПРОГРАММНЫЙ МОНИТОР — 16:9 кадр под плейхедом (градиент сцены + LUT
 * выбранного клипа, титр поверх), таймкод, транспорт, метки in/out
 * выбранного клипа и переключатель «Безопасная зона».
 */

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import {
  FILM_TITLE,
  FONT_CLASS,
  LUT_BY_ID,
  formatTc,
  type NleClip,
} from "./nle-data";

export function ProgramMonitor({
  frameClip,
  overlayTitle,
  selectedClip,
  playhead,
  playing,
  timelineEnd,
  safeZones,
  onToggleSafeZones,
  onTogglePlaying,
  onSeek,
  onSkipToStart,
  onSkipToEnd,
}: {
  frameClip: NleClip | null;
  overlayTitle: NleClip | null;
  selectedClip: NleClip | null;
  playhead: number;
  playing: boolean;
  timelineEnd: number;
  safeZones: boolean;
  onToggleSafeZones: (on: boolean) => void;
  onTogglePlaying: () => void;
  onSeek: (seconds: number) => void;
  onSkipToStart: () => void;
  onSkipToEnd: () => void;
}) {
  const lut = frameClip?.lut ? LUT_BY_ID[frameClip.lut] : null;
  const titleSize = overlayTitle?.size
    ? Math.min(Math.round(overlayTitle.size * 1.35), 88)
    : 46;

  const seekByRatio = (ratio: number) =>
    onSeek(Math.min(Math.max(ratio, 0), 1) * timelineEnd);

  return (
    <section aria-label="Программный монитор" className="min-w-0">
      <div className="relative aspect-video w-full select-none overflow-hidden rounded-xl border bg-stone-950 shadow-sm">
        {/* Кадр */}
        <div
          aria-hidden="true"
          style={lut ? { filter: lut.filter } : undefined}
          className={cn(
            "absolute inset-0 bg-gradient-to-br transition-all duration-500",
            frameClip?.gradient ?? "from-stone-900 via-stone-950 to-black",
          )}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(60%_65%_at_30%_25%,var(--primary)_0%,transparent_62%)] opacity-20"
        />
        {/* Горизонт и виньетка */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(115%_115%_at_50%_42%,transparent_60%,rgba(0,0,0,0.5)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.9) 0.5px, transparent 0.6px)",
            backgroundSize: "3px 3px",
          }}
        />

        {/* Титр поверх кадра */}
        {overlayTitle?.text ? (
          <div
            className={cn(
              "absolute inset-0 flex px-[7%]",
              overlayTitle.position === "top" && "items-start pt-[10%]",
              overlayTitle.position === "center" && "items-center",
              overlayTitle.position === "bottom" && "items-end pb-[10%]",
            )}
          >
            <p
              className={cn(
                "w-full text-center text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]",
                FONT_CLASS[overlayTitle.font ?? "serif"],
              )}
              style={{ fontSize: titleSize, lineHeight: 1.15 }}
            >
              {overlayTitle.text}
            </p>
          </div>
        ) : null}

        {/* Безопасные зоны */}
        {safeZones ? (
          <div aria-hidden="true" className="absolute inset-0">
            <span className="absolute inset-[5%] border border-dashed border-white/45" />
            <span className="absolute inset-[10%] border border-dashed border-primary/70" />
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/20" />
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
          </div>
        ) : null}

        {/* Бейджи */}
        <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-medium tracking-[0.18em] text-white/90 backdrop-blur">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn("size-1.5 rounded-full bg-primary", playing && "animate-pulse")}
              aria-hidden="true"
            />
            ПРОГРАММА
          </span>
        </span>
        <span className="pointer-events-none absolute right-3 top-3 z-10 hidden rounded-md border border-white/15 bg-black/45 px-2 py-1 font-mono text-[10px] tabular-nums text-white/90 backdrop-blur sm:block">
          1080p · 24 к/с
        </span>
        <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-white/15 bg-black/45 px-2 py-1 font-mono text-[10px] tabular-nums tracking-wide text-white/90 backdrop-blur">
          {formatTc(playhead)}
        </span>
        <span className="pointer-events-none absolute bottom-3 right-3 z-10 hidden max-w-[55%] truncate rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[10px] text-white/80 backdrop-blur sm:block">
          {frameClip ? frameClip.name : "нет кадра под плейхедом"}
        </span>

        {/* Транспорт по центру кадра */}
        <button
          type="button"
          onClick={onTogglePlaying}
          aria-label={playing ? "Поставить на паузу" : "Воспроизвести программу"}
          className="absolute left-1/2 top-1/2 z-10 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-background/20 text-white shadow-lg backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          {playing ? (
            <Pause className="size-6" aria-hidden="true" />
          ) : (
            <Play className="size-6 translate-x-0.5" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Транспорт-бар */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onSkipToStart}
            aria-label="В начало фильма"
          >
            <SkipBack aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onTogglePlaying}
            aria-label={playing ? "Пауза" : "Воспроизвести"}
          >
            {playing ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onSkipToEnd}
            aria-label="В конец фильма"
          >
            <SkipForward aria-hidden="true" />
          </Button>
        </div>

        {/* Скраб-бар с метками in/out выбранного клипа */}
        <div
          role="slider"
          aria-label="Позиция воспроизведения"
          aria-valuemin={0}
          aria-valuemax={Math.round(timelineEnd)}
          aria-valuenow={Math.round(playhead)}
          aria-valuetext={formatTc(playhead)}
          tabIndex={0}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            seekByRatio((e.clientX - rect.left) / rect.width);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") onSeek(playhead - 5);
            if (e.key === "ArrowRight") onSeek(playhead + 5);
          }}
          className="relative h-2 min-w-[160px] flex-1 cursor-pointer rounded-full bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${(playhead / timelineEnd) * 100}%` }}
          />
          {selectedClip ? (
            <>
              <span
                aria-hidden="true"
                className="absolute inset-y-0 rounded-xs border-x border-white/60 bg-white/15"
                style={{
                  left: `${(selectedClip.start / timelineEnd) * 100}%`,
                  width: `${(selectedClip.duration / timelineEnd) * 100}%`,
                }}
              />
              <span
                aria-hidden="true"
                className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-white"
                style={{ left: `${(selectedClip.start / timelineEnd) * 100}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-white"
                style={{
                  left: `${((selectedClip.start + selectedClip.duration) / timelineEnd) * 100}%`,
                }}
              />
            </>
          ) : null}
          <span
            aria-hidden="true"
            className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary-foreground shadow"
            style={{ left: `${(playhead / timelineEnd) * 100}%` }}
          />
        </div>

        {/* In / Out выбранного клипа */}
        <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums">
          {selectedClip ? (
            <>
              <span className="rounded border bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                IN {formatTc(selectedClip.start)}
              </span>
              <span className="rounded border bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
                OUT {formatTc(selectedClip.start + selectedClip.duration)}
              </span>
            </>
          ) : (
            <span className="rounded border bg-muted/60 px-1.5 py-0.5 text-muted-foreground">
              {FILM_TITLE} · in/out —
            </span>
          )}
        </div>

        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
          <Switch
            checked={safeZones}
            onCheckedChange={onToggleSafeZones}
            aria-label="Показать безопасные зоны"
          />
          Безопасная зона
        </label>
      </div>
    </section>
  );
}
