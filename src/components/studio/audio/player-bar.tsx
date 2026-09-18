"use client";

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatSpeed, formatTime, TRACK_TYPE_LABEL, type AudioTrack } from "./tracks-data";

/**
 * Липкий плеер внизу экрана: обложка, транспорт,
 * кликабельный скраббер с плавным CSS-переходом и громкость.
 */
export function PlayerBar({
  track,
  playing,
  progressSec,
  volume,
  speed,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onCycleSpeed,
}: {
  track: AudioTrack;
  playing: boolean;
  progressSec: number;
  volume: number;
  speed: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (sec: number) => void;
  onVolumeChange: (v: number) => void;
  onCycleSpeed: () => void;
}) {
  const Icon = track.icon;
  const fraction = Math.min(1, progressSec / track.durationSec);

  return (
    <footer aria-label="Плеер студии" className="shrink-0 border-t bg-card px-3 py-3 sm:px-4">
      <div className="flex items-center gap-3">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-lg shadow-inner"
          style={{ background: track.gradient }}
          aria-hidden="true"
        >
          <Icon className="size-5 text-white/85" />
        </div>
        <div className="hidden min-w-0 sm:block sm:max-w-44 lg:max-w-60">
          <p className="truncate text-sm font-medium">{track.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {TRACK_TYPE_LABEL[track.type]} · {track.meta}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onPrev}
            aria-label="Предыдущая дорожка"
          >
            <SkipBack className="size-4" aria-hidden="true" />
          </Button>
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
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onNext}
            aria-label="Следующая дорожка"
          >
            <SkipForward className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="order-last flex w-full min-w-0 flex-1 items-center gap-3 sm:order-none sm:w-auto">
          <span className="w-9 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
            {formatTime(progressSec)}
          </span>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Позиция воспроизведения"
            aria-valuemin={0}
            aria-valuemax={track.durationSec}
            aria-valuenow={Math.round(progressSec)}
            aria-valuetext={`${formatTime(progressSec)} из ${formatTime(track.durationSec)}`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSeek(((e.clientX - rect.left) / rect.width) * track.durationSec);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") onSeek(progressSec - 5);
              if (e.key === "ArrowRight") onSeek(progressSec + 5);
            }}
            className="group relative flex h-6 min-w-24 flex-1 cursor-pointer items-center"
          >
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-linear"
                style={{ width: `${fraction * 100}%` }}
              />
            </div>
            <span
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow transition-transform group-hover:scale-125"
              style={{ left: `${fraction * 100}%` }}
              aria-hidden="true"
            />
          </div>
          <span className="w-9 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatTime(track.durationSec)}
          </span>
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-3 sm:flex">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => onVolumeChange(volume === 0 ? 72 : 0)}
              aria-label={volume === 0 ? "Включить звук" : "Выключить звук"}
            >
              {volume === 0 ? (
                <VolumeX className="size-4" aria-hidden="true" />
              ) : (
                <Volume2 className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[volume]}
              onValueChange={([v]) => onVolumeChange(v)}
              className="w-24"
              aria-label="Громкость"
            />
          </div>
          <button
            type="button"
            onClick={onCycleSpeed}
            aria-label="Скорость воспроизведения"
            className="inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {formatSpeed(speed)}
          </button>
        </div>
      </div>
    </footer>
  );
}
