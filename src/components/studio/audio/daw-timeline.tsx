"use client";

import { useMemo, useState } from "react";
import { AudioLines, Layers, Minus, Plus, ZoomIn, ZoomOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { ClipInspector } from "./clip-inspector";
import {
  LOOP_END,
  LOOP_START,
  TOTAL_BARS,
  panLabel,
  semitoneLabel,
  type DawClip,
  type DawTrackId,
  type DawTrackState,
} from "./daw-data";

/** Ширина заголовка дорожки (Tailwind w-44 = 11rem). */
const HEADER_W = 176;
/** Пикселей на такт для уровней зума. */
const PX_PER_BAR = [36, 52, 76, 108];

/**
 * Мультитрековый таймлайн: линейка тактов, дорожки с клипами,
 * плейхед, регион лупа и инспектор клипа.
 */
export function DawTimeline({
  tracks,
  clips,
  selectedClipId,
  playhead,
  playing,
  loopEnabled,
  stemTitle,
  onToggleLoop,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onStepTranspose,
  onSelectClip,
  onDuplicateClip,
  onTransposeClip,
  onDeleteClip,
}: {
  tracks: DawTrackState[];
  clips: DawClip[];
  selectedClipId: string | null;
  playhead: number;
  playing: boolean;
  loopEnabled: boolean;
  stemTitle: string | null;
  onToggleLoop: () => void;
  onToggleMute: (id: DawTrackId) => void;
  onToggleSolo: (id: DawTrackId) => void;
  onVolumeChange: (id: DawTrackId, v: number) => void;
  onStepTranspose: (id: DawTrackId, delta: number) => void;
  onSelectClip: (id: string | null) => void;
  onDuplicateClip: (id: string) => void;
  onTransposeClip: (id: string, delta: number) => void;
  onDeleteClip: (id: string) => void;
}) {
  const [zoomIdx, setZoomIdx] = useState(1);
  const px = PX_PER_BAR[zoomIdx];
  const laneW = TOTAL_BARS * px;

  const anySolo = tracks.some((t) => t.solo);
  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId],
  );

  return (
    <section
      aria-label="Таймлайн студии"
      className="relative flex min-h-[20rem] flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:min-h-0"
    >
      {/* Панель инструментов таймлайна */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <AudioLines className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Таймлайн</h3>
        <span className="rounded-full border bg-background px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          {TOTAL_BARS} тактов · 4/4
        </span>
        {stemTitle ? (
          <span className="inline-flex max-w-56 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Layers className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">Проект «{stemTitle}»</span>
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
            disabled={zoomIdx === 0}
            aria-label="Уменьшить масштаб"
          >
            <ZoomOut className="size-3.5" aria-hidden="true" />
          </Button>
          <span className="w-8 text-center font-mono text-[10px] tabular-nums text-muted-foreground">
            {Math.round((px / PX_PER_BAR[1]) * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-7"
            onClick={() => setZoomIdx((z) => Math.min(PX_PER_BAR.length - 1, z + 1))}
            disabled={zoomIdx === PX_PER_BAR.length - 1}
            aria-label="Увеличить масштаб"
          >
            <ZoomIn className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {/* Прокручиваемая область: линейка + дорожки + плейхед */}
      <div className="vf-scroll relative min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: HEADER_W + laneW }}>
          {/* Линейка тактов */}
          <div className="sticky top-0 z-[35] flex h-6 border-b bg-card backdrop-blur">
            <div className="sticky left-0 z-40 flex w-44 shrink-0 items-center border-r bg-card px-2">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Дорожки
              </span>
            </div>
            <div className="relative" style={{ width: laneW }}>
              {Array.from({ length: TOTAL_BARS }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "absolute top-0 h-full border-l pl-1 font-mono text-[9px] leading-6 tabular-nums",
                    i % 4 === 0 ? "text-muted-foreground" : "border-border/40 text-muted-foreground/40",
                  )}
                  style={{ left: i * px }}
                >
                  {i + 1}
                </span>
              ))}
              {/* Регион лупа */}
              <button
                type="button"
                onClick={onToggleLoop}
                aria-pressed={loopEnabled}
                aria-label={`Луп тактов ${LOOP_START + 1}–${LOOP_END}: ${loopEnabled ? "выключить" : "включить"}`}
                title={`Луп ${LOOP_START + 1}–${LOOP_END}`}
                className={cn(
                  "absolute top-0 h-[7px] rounded-b-sm border-x border-b transition-colors",
                  loopEnabled
                    ? "border-primary/70 bg-primary/60"
                    : "border-muted-foreground/40 bg-muted-foreground/25 hover:bg-muted-foreground/40",
                )}
                style={{ left: LOOP_START * px, width: (LOOP_END - LOOP_START) * px }}
              >
                <span className="absolute -bottom-px left-0 h-1.5 w-1 rounded-b-sm bg-current opacity-80" aria-hidden="true" />
                <span className="absolute -bottom-px right-0 h-1.5 w-1 rounded-b-sm bg-current opacity-80" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Дорожки */}
          {tracks.map((track) => {
            const dimmed = track.muted || (anySolo && !track.solo);
            return (
              <div key={track.id} className="flex border-b last:border-b-0">
                <TrackHeader
                  track={track}
                  onToggleMute={onToggleMute}
                  onToggleSolo={onToggleSolo}
                  onVolumeChange={onVolumeChange}
                  onStepTranspose={onStepTranspose}
                />
                <div
                  className="relative h-[72px] shrink-0"
                  style={{ width: laneW }}
                  aria-label={`Дорожка «${track.name}»`}
                  onClick={() => onSelectClip(null)}
                >
                  {/* Сетка тактов */}
                  {Array.from({ length: TOTAL_BARS + 1 }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "absolute inset-y-0 border-l",
                        i % 4 === 0 ? "border-border" : "border-border/40",
                      )}
                      style={{ left: i * px }}
                      aria-hidden="true"
                    />
                  ))}
                  {track.id === "record" && clips.every((c) => c.trackId !== "record") ? (
                    <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-muted-foreground/60">
                      пусто · включите запись с микрофона
                    </span>
                  ) : null}
                  {/* Клипы */}
                  {clips
                    .filter((c) => c.trackId === track.id)
                    .map((clip) => (
                      <ClipBlock
                        key={clip.id}
                        clip={clip}
                        track={track}
                        px={px}
                        selected={clip.id === selectedClipId}
                        dimmed={dimmed}
                        onSelect={onSelectClip}
                      />
                    ))}
                </div>
              </div>
            );
          })}

          {/* Плейхед */}
          <div
            className="pointer-events-none absolute inset-y-0 z-[25] w-px bg-primary"
            style={{
              left: HEADER_W + playhead * px,
              transition: playing ? `left 100ms linear` : "left 150ms ease",
              boxShadow: "0 0 6px var(--primary)",
            }}
            aria-hidden="true"
          >
            <span className="absolute -left-[3px] top-0 size-[7px] rotate-45 rounded-[2px] bg-primary" />
          </div>
        </div>
      </div>

      {/* Инспектор выбранного клипа */}
      {selectedClip ? (
        <ClipInspector
          clip={selectedClip}
          track={tracks.find((t) => t.id === selectedClip.trackId) ?? tracks[0]}
          onClose={() => onSelectClip(null)}
          onDuplicate={() => onDuplicateClip(selectedClip.id)}
          onTranspose={(d) => onTransposeClip(selectedClip.id, d)}
          onDelete={() => onDeleteClip(selectedClip.id)}
        />
      ) : null}
    </section>
  );
}

/* ——— Заголовок дорожки ——— */

function TrackHeader({
  track,
  onToggleMute,
  onToggleSolo,
  onVolumeChange,
  onStepTranspose,
}: {
  track: DawTrackState;
  onToggleMute: (id: DawTrackId) => void;
  onToggleSolo: (id: DawTrackId) => void;
  onVolumeChange: (id: DawTrackId, v: number) => void;
  onStepTranspose: (id: DawTrackId, delta: number) => void;
}) {
  return (
    <div className="sticky left-0 z-30 flex w-44 shrink-0 flex-col justify-center gap-1 border-r bg-card px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: track.color }}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{track.name}</span>
        <button
          type="button"
          onClick={() => onToggleMute(track.id)}
          aria-pressed={track.muted}
          aria-label={track.muted ? `Включить дорожку ${track.name}` : `Заглушить дорожку ${track.name}`}
          className={cn(
            "flex size-5 items-center justify-center rounded border text-[10px] font-bold leading-none transition-colors",
            track.muted
              ? "border-amber-500/60 bg-amber-500/20 text-amber-600 dark:text-amber-400"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          M
        </button>
        <button
          type="button"
          onClick={() => onToggleSolo(track.id)}
          aria-pressed={track.solo}
          aria-label={`Соло дорожки ${track.name}`}
          className={cn(
            "flex size-5 items-center justify-center rounded border text-[10px] font-bold leading-none transition-colors",
            track.solo
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          S
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Slider
          min={0}
          max={100}
          step={1}
          value={[track.volume]}
          onValueChange={([v]) => onVolumeChange(track.id, v)}
          className="flex-1"
          aria-label={`Громкость дорожки ${track.name}`}
        />
        <span
          className="w-10 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground"
          title="Панорама"
        >
          {panLabel(track.pan)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onStepTranspose(track.id, -1)}
          disabled={track.transpose <= -12}
          aria-label={`Транспонировать ${track.name} на полтона вниз`}
          className="flex size-5 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          <Minus className="size-2.5" aria-hidden="true" />
        </button>
        <span
          className="w-10 text-center font-mono text-[9px] tabular-nums text-muted-foreground"
          title="Транспонирование"
        >
          {semitoneLabel(track.transpose)}
        </span>
        <button
          type="button"
          onClick={() => onStepTranspose(track.id, 1)}
          disabled={track.transpose >= 12}
          aria-label={`Транспонировать ${track.name} на полтона вверх`}
          className="flex size-5 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent disabled:opacity-40"
        >
          <Plus className="size-2.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/* ——— Клип на дорожке ——— */

function ClipBlock({
  clip,
  track,
  px,
  selected,
  dimmed,
  onSelect,
}: {
  clip: DawClip;
  track: DawTrackState;
  px: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: (id: string) => void;
}) {
  const n = clip.wave.length;
  const w = 100 / n;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(clip.id);
      }}
      aria-label={`Клип «${clip.name}», такт ${clip.startBar + 1}, длительность ${clip.lengthBars} тактов`}
      title={`${clip.name} · ${clip.key !== "—" ? `${clip.key} · ` : ""}${clip.bpm} BPM · ${clip.lengthBars} так.`}
      className={cn(
        "group absolute inset-y-[3px] flex flex-col overflow-hidden rounded-md border text-left shadow-sm outline-none transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-card",
        dimmed && "opacity-35",
      )}
      style={{
        left: clip.startBar * px,
        width: clip.lengthBars * px,
        background: `linear-gradient(135deg, ${track.colorSoft}, ${track.color}1f)`,
        borderColor: track.colorBorder,
      }}
    >
      <span className="truncate px-1.5 pt-[3px] text-[10px] font-medium leading-tight text-foreground/90">
        {clip.name}
      </span>
      <svg
        viewBox="0 0 100 18"
        preserveAspectRatio="none"
        className="min-h-0 w-full flex-1 px-1 pb-[3px]"
        aria-hidden="true"
      >
        {clip.wave.map((h, i) => (
          <rect
            key={i}
            x={i * w}
            y={9 - (h * 0.16) / 2}
            width={Math.max(0.8, w - 0.8)}
            height={Math.max(1.5, h * 0.16)}
            rx={0.4}
            fill={track.color}
            fillOpacity={0.85}
          />
        ))}
      </svg>
    </button>
  );
}
