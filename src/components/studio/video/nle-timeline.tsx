"use client";

/**
 * МУЛЬТИТРЕКОВЫЙ ТАЙМЛАЙН: линейка с таймкодами, дорожки V2/V1/A1/A2/Титры
 * (мьют, глаз, замок, мини-громкость), клипы-блоки, инструменты
 * (выбор / бритва / обрезка), магнитная привязка и анимированный плейхед.
 */

import {
  Crop,
  Eye,
  EyeOff,
  Lock,
  MousePointer,
  Scissors,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import type { NleTool, TrackRuntime } from "./use-nle-project";
import { ClipBlock } from "./clip-block";
import {
  formatDur,
  formatTc,
  HEADER_W,
  TRACKS,
  type NleClip,
  type TrackId,
} from "./nle-data";

const TOOLS: { id: NleTool; label: string; icon: typeof MousePointer }[] = [
  { id: "select", label: "Выбор", icon: MousePointer },
  { id: "razor", label: "Бритва", icon: Scissors },
  { id: "trim", label: "Обрезка", icon: Crop },
];

/* ── Таймлайн ───────────────────────────────────────────────────────── */

export function NleTimeline({
  clips,
  clipsByTrack,
  trackState,
  selectedId,
  tool,
  snapping,
  pps,
  playhead,
  playing,
  timelineEnd,
  onToolChange,
  onSelect,
  onSplit,
  onDeleteSelected,
  onSeek,
  onToggleTrackFlag,
  onTrackVolume,
  onBlocked,
}: {
  clips: NleClip[];
  clipsByTrack: Record<TrackId, NleClip[]>;
  trackState: Record<TrackId, TrackRuntime>;
  selectedId: string | null;
  tool: NleTool;
  snapping: boolean;
  pps: number;
  playhead: number;
  playing: boolean;
  timelineEnd: number;
  onToolChange: (tool: NleTool) => void;
  onSelect: (id: string) => void;
  onSplit: (id: string, ratio: number) => void;
  onDeleteSelected: () => void;
  onSeek: (seconds: number) => void;
  onToggleTrackFlag: (id: TrackId, flag: "muted" | "hidden" | "locked") => void;
  onTrackVolume: (id: TrackId, volume: number) => void;
  onBlocked: () => void;
}) {
  const ticks: number[] = [];
  for (let t = 0; t <= timelineEnd; t += 30) ticks.push(t);
  const labels = ticks.filter((t) => t % 60 === 0);
  const contentWidth = HEADER_W + timelineEnd * pps;

  return (
    <section
      aria-label="Монтажный стол"
      className="min-w-0 rounded-xl border bg-card p-3 sm:p-4"
    >
      {/* Инструменты */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Монтажный стол
        </h3>
        <span className="rounded-full border bg-muted/60 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {clips.length} клипов
        </span>
        <span
          className={cn(
            "hidden rounded-full border px-2 py-0.5 text-[10px] font-medium sm:inline-flex",
            snapping
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-muted/60 text-muted-foreground",
          )}
        >
          {snapping ? "магнит: привязка вкл" : "магнит: привязка выкл"}
        </span>

        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Инструменты монтажа">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <Button
                key={t.id}
                variant={active ? "default" : "ghost"}
                size="sm"
                onClick={() => onToolChange(t.id)}
                aria-pressed={active}
                aria-label={`Инструмент «${t.label}»`}
                title={t.label}
                className="h-8 gap-1.5 px-2 text-[11px]"
              >
                <Icon aria-hidden="true" />
                <span className="hidden sm:inline">{t.label}</span>
              </Button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteSelected()}
            disabled={!selectedId}
            aria-label="Удалить выбранный клип"
            title="Удалить выбранный клип (Delete)"
            className="h-8 gap-1.5 px-2 text-[11px] text-destructive hover:text-destructive"
          >
            <Trash2 aria-hidden="true" />
            <span className="hidden sm:inline">Удалить</span>
          </Button>
        </div>
      </div>

      {/* Прокручиваемая область */}
      <div className="vf-scroll overflow-x-auto rounded-lg border border-border/70 bg-background/40">
        <div className="relative" style={{ width: contentWidth }}>
          {/* Запас под флажок плейхеда */}
          <div aria-hidden="true" className="h-4" />

          {/* Линейка */}
          <div className="flex h-6 border-b border-border/70">
            <div
              style={{ width: HEADER_W }}
              className="sticky left-0 z-20 flex shrink-0 items-center border-r border-border/70 bg-card px-2"
            >
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                шкала
              </span>
            </div>
            <div
              className="relative min-w-0 flex-1 cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onSeek(((e.clientX - rect.left) / rect.width) * timelineEnd);
              }}
              role="presentation"
            >
              {ticks.map((t) => {
                const major = t % 60 === 0;
                return (
                  <span
                    key={t}
                    aria-hidden="true"
                    className={cn(
                      "absolute bottom-0 w-px",
                      major ? "h-2.5 bg-muted-foreground/50" : "h-1.5 bg-border",
                    )}
                    style={{ left: t * pps }}
                  />
                );
              })}
              {labels.map((t) => (
                <span
                  key={t}
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0 font-mono text-[9px] leading-none text-muted-foreground",
                    t === 0
                      ? "translate-x-0"
                      : t === timelineEnd
                        ? "-translate-x-full"
                        : "-translate-x-1/2",
                  )}
                  style={{ left: t * pps }}
                >
                  {formatDur(t)}
                </span>
              ))}
            </div>
          </div>

          {/* Дорожки */}
          {TRACKS.map((track) => {
            const runtime = trackState[track.id];
            const Icon = track.icon;
            return (
              <div
                key={track.id}
                role="group"
                aria-label={`Дорожка ${track.label}`}
                className="flex border-b border-border/50 last:border-b-0"
                style={{ height: track.height }}
              >
                {/* Заголовок дорожки */}
                <div
                  style={{ width: HEADER_W }}
                  className="sticky left-0 z-20 flex shrink-0 flex-col justify-center gap-1 border-r border-border/70 bg-card px-2"
                >
                  <p
                    className="flex items-center gap-1 truncate text-[10px] font-semibold leading-none"
                    title={track.label}
                  >
                    <Icon className="size-3 shrink-0 text-primary" aria-hidden="true" />
                    {track.label}
                  </p>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => onToggleTrackFlag(track.id, "muted")}
                      aria-pressed={runtime.muted}
                      aria-label={
                        runtime.muted
                          ? `Включить звук дорожки ${track.label}`
                          : `Заглушить дорожку ${track.label}`
                      }
                      className="flex size-5 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {runtime.muted ? (
                        <VolumeX className="size-3 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <Volume2 className="size-3 text-primary" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleTrackFlag(track.id, "hidden")}
                      aria-pressed={runtime.hidden}
                      aria-label={
                        runtime.hidden
                          ? `Показать дорожку ${track.label}`
                          : `Скрыть дорожку ${track.label}`
                      }
                      className="flex size-5 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {runtime.hidden ? (
                        <EyeOff className="size-3 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <Eye className="size-3 text-muted-foreground" aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleTrackFlag(track.id, "locked")}
                      aria-pressed={runtime.locked}
                      aria-label={
                        runtime.locked
                          ? `Разблокировать дорожку ${track.label}`
                          : `Заблокировать дорожку ${track.label}`
                      }
                      className="flex size-5 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <Lock
                        className={cn(
                          "size-3",
                          runtime.locked
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground/60",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                  <Slider
                    value={[runtime.volume]}
                    onValueChange={(v) => onTrackVolume(track.id, v[0] ?? 0)}
                    aria-label={`Громкость дорожки ${track.label}`}
                    className="h-3"
                  />
                </div>

                {/* Лента дорожки */}
                <div className="relative min-w-0 flex-1">
                  {clipsByTrack[track.id].map((clip) => (
                    <ClipBlock
                      key={clip.id}
                      clip={clip}
                      selected={clip.id === selectedId}
                      tool={tool}
                      snapping={snapping}
                      pps={pps}
                      runtime={runtime}
                      onSelect={() => onSelect(clip.id)}
                      onSplit={(ratio) => onSplit(clip.id, ratio)}
                      onBlocked={onBlocked}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Плейхед */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 top-2 z-10"
            style={{ left: HEADER_W + playhead * pps }}
          >
            <span
              className={cn(
                "absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-primary",
                playing && "animate-pulse",
              )}
            />
            <span className="absolute top-0 size-2 -translate-x-1/2 rotate-45 bg-primary" />
            <span className="absolute -top-1 left-0 -translate-x-1/2 rounded bg-primary px-1 py-px font-mono text-[9px] font-semibold leading-tight tabular-nums text-primary-foreground shadow">
              {formatTc(playhead)}
            </span>
          </div>
        </div>
      </div>

      {/* Подсказка */}
      <p className="mt-2 hidden text-[10px] text-muted-foreground/80 sm:block">
        Бритва делит клип по точке клика · клик по линейке перемещает плейхед ·
        клик по клипу выбирает его для инспектора
      </p>
    </section>
  );
}
