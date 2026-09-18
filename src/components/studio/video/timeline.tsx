"use client";

import { Film } from "lucide-react";

import { cn } from "@/lib/utils";

import { formatTime, type SceneCard } from "./video-data";

/** Градиенты сегментов монтажа — изумрудные вариации + каменные тона. */
const SEGMENT_GRADIENTS = [
  "from-emerald-800 to-emerald-950",
  "from-emerald-600 to-emerald-900",
  "from-emerald-400 to-emerald-700",
  "from-stone-500 to-stone-700",
  "from-stone-600 to-stone-800",
];

/** Шкала: деления каждые 5 с, подписи каждые 15 с. */
const MINOR_TICKS = Array.from({ length: 19 }, (_, i) => i * 5);

/**
 * Таймлайн-скраббер: линейка с делениями, сегменты сцен
 * (ширина пропорциональна длительности), изумрудный плейхед
 * и моно-счётчик времени.
 */
export function Timeline({
  scenes,
  selectedSceneId,
  onSelectScene,
  playing,
  currentSeconds,
}: {
  scenes: SceneCard[];
  selectedSceneId: number;
  onSelectScene: (sceneId: number) => void;
  playing: boolean;
  currentSeconds: number;
}) {
  const total = scenes.reduce((acc, s) => acc + s.duration, 0);
  const playheadPct = `${((currentSeconds / total) * 100).toFixed(2)}%`;

  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <Film
            className="size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <h2 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Хронометраж
          </h2>
          <span className="truncate rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            черновой монтаж · {scenes.length} из 8 сцен
          </span>
        </div>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          <span className="font-semibold text-foreground">
            {formatTime(currentSeconds)}
          </span>
          {" / "}
          {formatTime(total)}
        </p>
      </div>

      <div className="relative">
        {/* Линейка */}
        <div aria-hidden="true" className="relative mb-1 h-5">
          {MINOR_TICKS.map((t) => {
            const major = t % 15 === 0;
            return (
              <span
                key={t}
                className={cn(
                  "absolute bottom-0 w-px",
                  major ? "h-2.5 bg-muted-foreground/50" : "h-1 bg-border",
                )}
                style={{ left: `${(t / total) * 100}%` }}
              />
            );
          })}
          {MINOR_TICKS.filter((t) => t % 15 === 0).map((t) => {
            const first = t === 0;
            const last = t === total;
            return (
              <span
                key={t}
                className={cn(
                  "absolute top-0 font-mono text-[9px] leading-none text-muted-foreground",
                  first
                    ? "translate-x-0"
                    : last
                      ? "-translate-x-full"
                      : "-translate-x-1/2",
                )}
                style={{ left: `${(t / total) * 100}%` }}
              >
                {t}с
              </span>
            );
          })}
        </div>

        {/* Сегменты сцен */}
        <div
          role="group"
          aria-label="Дорожка монтажа по сценам"
          className="flex h-10 cursor-pointer gap-1"
        >
          {scenes.map((scene, i) => {
            const selected = scene.id === selectedSceneId;
            return (
              <button
                key={scene.id}
                type="button"
                style={{ flexGrow: scene.duration, flexBasis: 0 }}
                onClick={() => onSelectScene(scene.id)}
                aria-pressed={selected}
                aria-label={`Сцена ${i + 1}: ${scene.title}, ${scene.duration} секунд`}
                className="group relative min-w-0 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-0 rounded-md bg-gradient-to-r",
                    SEGMENT_GRADIENTS[i % SEGMENT_GRADIENTS.length],
                    selected && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  )}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-md bg-black/25 opacity-0 transition-opacity group-hover:opacity-100"
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 hidden items-center justify-center font-mono text-[10px] font-medium text-white/90 sm:flex"
                >
                  {scene.duration}с
                </span>
                <span className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[10px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                  Сцена {i + 1} · {scene.title} · {scene.duration}с
                </span>
              </button>
            );
          })}
        </div>

        {/* Просмотренная часть дорожки */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-10 rounded-l-md bg-white/[0.07]"
          style={{ width: playheadPct }}
        />

        {/* Плейхед */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 z-10"
          style={{ left: playheadPct }}
        >
          <span
            className={cn(
              "absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-primary",
              playing && "animate-pulse",
            )}
          />
          <span className="absolute top-0 size-2 -translate-x-1/2 rotate-45 bg-primary" />
          <span className="absolute top-6 left-1/2 -translate-x-1/2 rounded bg-primary px-1 py-px font-mono text-[9px] font-semibold leading-tight tabular-nums text-primary-foreground shadow-sm">
            {formatTime(currentSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}
