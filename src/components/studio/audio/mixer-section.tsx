"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  MASTER_EQ,
  panLabel,
  volumeDb,
  type DawTrackId,
  type DawTrackState,
} from "./daw-data";

/**
 * Микшер — сворачиваемая нижняя секция DAW: канал-стрипы каждой
 * дорожки (EQ, панорама, вертикальный фейдер, mute/solo) + мастер.
 */
export function MixerSection({
  open,
  onOpenChange,
  tracks,
  masterVolume,
  onVolumeChange,
  onPanChange,
  onToggleMute,
  onToggleSolo,
  onMasterVolumeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tracks: DawTrackState[];
  masterVolume: number;
  onVolumeChange: (id: DawTrackId, v: number) => void;
  onPanChange: (id: DawTrackId, v: number) => void;
  onToggleMute: (id: DawTrackId) => void;
  onToggleSolo: (id: DawTrackId) => void;
  onMasterVolumeChange: (v: number) => void;
}) {
  return (
    <section
      id="daw-mixer"
      aria-label="Микшер"
      className="shrink-0 rounded-xl border bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center gap-2 px-3 py-2">
        <SlidersHorizontal className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Микшер</h3>
        <span className="hidden text-[10px] text-muted-foreground sm:inline">
          {tracks.length} каналов + мастер
        </span>
        <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
          мастер {masterVolume}% · {volumeDb(masterVolume)} дБ
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-label={open ? "Свернуть микшер" : "Развернуть микшер"}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", !open && "-rotate-90")}
            aria-hidden="true"
          />
        </Button>
      </header>

      {open ? (
        <div
          className="vf-scroll flex gap-2 overflow-x-auto border-t px-3 py-2.5"
          role="group"
          aria-label="Каналы микшера"
        >
          {tracks.map((t) => (
            <ChannelStrip
              key={t.id}
              track={t}
              onVolumeChange={onVolumeChange}
              onPanChange={onPanChange}
              onToggleMute={onToggleMute}
              onToggleSolo={onToggleSolo}
            />
          ))}
          <div className="w-px shrink-0 self-stretch bg-border" aria-hidden="true" />
          <MasterStrip volume={masterVolume} onChange={onMasterVolumeChange} />
        </div>
      ) : null}
    </section>
  );
}

/* ——— EQ-кривая (мок SVG) ——— */

function EqCurve({ gains, color }: { gains: number[]; color: string }) {
  const stepX = 64 / (gains.length - 1);
  const y = (g: number) => 16 - Math.max(-12, Math.min(12, g));
  const points = gains.map((g, i) => `${i * stepX},${y(g)}`).join(" ");
  return (
    <svg viewBox="0 0 64 32" className="h-8 w-full" aria-hidden="true">
      {[8, 16, 24].map((yy) => (
        <line key={yy} x1="2" y1={yy} x2="62" y2={yy} stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/40" />
      ))}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {gains.map((g, i) => (
        <circle key={i} cx={i * stepX} cy={y(g)} r="1.4" fill={color} />
      ))}
    </svg>
  );
}

/* ——— Канал дорожки ——— */

function ChannelStrip({
  track,
  onVolumeChange,
  onPanChange,
  onToggleMute,
  onToggleSolo,
}: {
  track: DawTrackState;
  onVolumeChange: (id: DawTrackId, v: number) => void;
  onPanChange: (id: DawTrackId, v: number) => void;
  onToggleMute: (id: DawTrackId) => void;
  onToggleSolo: (id: DawTrackId) => void;
}) {
  return (
    <article
      className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-lg border bg-background px-1.5 py-2"
      aria-label={`Канал «${track.name}»`}
    >
      <div className="flex w-full items-center justify-center gap-1">
        <span className="size-2 shrink-0 rounded-full" style={{ background: track.color }} aria-hidden="true" />
        <span className="truncate text-[11px] font-medium">{track.name}</span>
      </div>

      <EqCurve gains={track.eq} color={track.color} />

      <div className="flex w-full flex-col items-center gap-0.5">
        <Slider
          min={-100}
          max={100}
          step={5}
          value={[track.pan]}
          onValueChange={([v]) => onPanChange(track.id, v)}
          className="w-full"
          aria-label={`Панорама канала ${track.name}`}
        />
        <span className="font-mono text-[9px] tabular-nums text-muted-foreground">
          {panLabel(track.pan)}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1">
        <Slider
          orientation="vertical"
          min={0}
          max={100}
          step={1}
          value={[track.volume]}
          onValueChange={([v]) => onVolumeChange(track.id, v)}
          className="h-36"
          aria-label={`Громкость канала ${track.name}`}
        />
        <span className="font-mono text-[10px] font-medium tabular-nums">
          {volumeDb(track.volume)} дБ
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleMute(track.id)}
          aria-pressed={track.muted}
          aria-label={`Mute канала ${track.name}`}
          className={cn(
            "flex size-5 items-center justify-center rounded border text-[9px] font-bold",
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
          aria-label={`Solo канала ${track.name}`}
          className={cn(
            "flex size-5 items-center justify-center rounded border text-[9px] font-bold",
            track.solo
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          S
        </button>
      </div>
    </article>
  );
}

/* ——— Мастер-канал ——— */

function MasterStrip({ volume, onChange }: { volume: number; onChange: (v: number) => void }) {
  return (
    <article
      className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-1.5 py-2"
      aria-label="Мастер-канал"
    >
      <span className="text-[11px] font-semibold text-primary">Мастер</span>
      <EqCurve gains={MASTER_EQ} color="var(--primary)" />
      <span className="font-mono text-[9px] tabular-nums text-muted-foreground">−∞…0 дБ</span>
      <div className="flex flex-col items-center gap-1">
        <Slider
          orientation="vertical"
          min={0}
          max={100}
          step={1}
          value={[volume]}
          onValueChange={([v]) => onChange(v)}
          className="h-36"
          aria-label="Мастер-громкость"
        />
        <span className="font-mono text-[10px] font-medium tabular-nums">
          {volumeDb(volume)} дБ
        </span>
      </div>
      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
        SUM
      </span>
    </article>
  );
}
