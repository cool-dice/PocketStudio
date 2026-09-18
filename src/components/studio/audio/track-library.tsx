"use client";

import { MoreHorizontal, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatTime,
  TRACK_STATUS_META,
  TRACK_TYPE_DOT,
  TRACK_TYPE_LABEL,
  type AudioTrack,
} from "./tracks-data";

/** Скроллящийся список дорожек студии. */
export function TrackLibrary({
  tracks,
  currentId,
  playing,
  onTogglePlay,
  onSelect,
}: {
  tracks: AudioTrack[];
  currentId: string;
  playing: boolean;
  onTogglePlay: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Библиотека</h2>
        <span className="text-xs text-muted-foreground">{tracks.length} дорожек</span>
      </div>
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Дорожки студии">
        <ul className="space-y-1 pb-1">
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              isCurrent={track.id === currentId}
              playing={playing}
              onTogglePlay={onTogglePlay}
              onSelect={onSelect}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function TrackRow({
  track,
  isCurrent,
  playing,
  onTogglePlay,
  onSelect,
}: {
  track: AudioTrack;
  isCurrent: boolean;
  playing: boolean;
  onTogglePlay: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const isPlaying = isCurrent && playing;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-accent/50",
        isCurrent && "border-border bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={() => onTogglePlay(track.id)}
        aria-label={
          isPlaying ? `Пауза — ${track.title}` : `Воспроизвести — ${track.title}`
        }
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
          isCurrent
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-card text-foreground hover:border-primary/40 hover:text-primary",
        )}
      >
        {isPlaying ? (
          <Pause className="size-4" aria-hidden="true" />
        ) : (
          <Play className="size-4 translate-x-px" aria-hidden="true" />
        )}
      </button>

      <span className="hidden h-7 w-24 shrink-0 items-center gap-[2px] sm:flex" aria-hidden="true">
        {track.bars.map((h, i) => (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full",
              isPlaying ? "animate-pulse bg-primary" : "bg-muted-foreground/30",
            )}
            style={{
              height: `${isPlaying ? h : Math.round(h * 0.7)}%`,
              animationDelay: `${(i % 6) * 90}ms`,
            }}
          />
        ))}
      </span>

      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(track.id)}>
        <span className="block truncate text-sm font-medium">{track.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{track.meta}</span>
      </button>

      <span className="hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground md:inline-flex">
        <span
          className={cn("size-1.5 rounded-full", TRACK_TYPE_DOT[track.type])}
          aria-hidden="true"
        />
        {TRACK_TYPE_LABEL[track.type]}
      </span>

      <span className="hidden shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:inline">
        {formatTime(track.durationSec)}
      </span>

      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          TRACK_STATUS_META[track.status].className,
        )}
      >
        {TRACK_STATUS_META[track.status].label}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground"
        aria-label={`Меню дорожки «${track.title}»`}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </Button>
    </li>
  );
}
