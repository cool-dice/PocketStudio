"use client";

/**
 * Клип-блок на таймлайне: градиентный миниатюрный «кадр» (видео/изображение),
 * вейвформа (аудио), текстовый превью (титры), магнитная привязка,
 * индикатор LUT и перехода, ручки обрезки и логика «бритвы».
 */

import { cn } from "@/lib/utils";

import type { TrackRuntime, NleTool } from "./use-nle-project";
import {
  FONT_CLASS,
  formatDur,
  LUT_BY_ID,
  TRACK_BY_ID,
  TRANSITION_BY_ID,
  type NleClip,
} from "./nle-data";

const WAVE_STYLE = {
  backgroundImage:
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.34) 0 2px, transparent 2px 6px), repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0 1px, transparent 1px 11px)",
} as const;

export function ClipBlock({
  clip,
  selected,
  tool,
  snapping,
  pps,
  runtime,
  onSelect,
  onSplit,
  onBlocked,
}: {
  clip: NleClip;
  selected: boolean;
  tool: NleTool;
  snapping: boolean;
  pps: number;
  runtime: TrackRuntime;
  onSelect: () => void;
  onSplit: (ratio: number) => void;
  onBlocked: () => void;
}) {
  const width = Math.max(clip.duration * pps, 14);
  const titleFontSize = Math.min(
    Math.max(Math.round((clip.size ?? 32) * 0.18), 8),
    13,
  );
  const TransitionIcon = clip.transition
    ? TRANSITION_BY_ID[clip.transition].icon
    : null;
  /** LUT применяется к миниатюре клипа вживую (CSS-фильтр). */
  const lutFilter = clip.lut ? LUT_BY_ID[clip.lut].filter : null;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (runtime.locked) {
      onBlocked();
      return;
    }
    if (tool === "razor") {
      const rect = e.currentTarget.getBoundingClientRect();
      onSplit((e.clientX - rect.left) / rect.width);
      return;
    }
    onSelect();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={selected}
      aria-label={`${clip.name}, ${formatDur(clip.duration)}, дорожка ${
        TRACK_BY_ID[clip.trackId].label
      }${runtime.locked ? ", дорожка заблокирована" : ""}`}
      title={runtime.locked ? "Дорожка заблокирована" : clip.name}
      style={{ left: clip.start * pps, width }}
      className={cn(
        "group absolute inset-y-1 overflow-hidden rounded-md border border-white/10 text-left shadow-sm outline-none transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/50",
        tool === "razor" && !runtime.locked && "cursor-crosshair",
        runtime.locked && "cursor-not-allowed opacity-60",
        runtime.hidden && "opacity-30 saturate-0",
        runtime.muted && "opacity-70",
        selected
          ? "z-[5] ring-2 ring-primary"
          : "hover:ring-1 hover:ring-primary/50",
      )}
    >
      {/* Основа клипа (LUT красит миниатюру вживую) */}
      <span
        aria-hidden="true"
        style={lutFilter ? { filter: lutFilter } : undefined}
        className={cn(
          "absolute inset-0 bg-gradient-to-br transition-[filter] duration-300",
          clip.kind === "title"
            ? "from-stone-800 to-black"
            : clip.gradient,
        )}
      />

      {/* Вейвформа для аудио */}
      {clip.kind === "audio" ? (
        <span
          aria-hidden="true"
          style={WAVE_STYLE}
          className="absolute inset-x-1 top-1/2 h-[58%] -translate-y-1/2 rounded-sm opacity-80"
        />
      ) : null}

      {/* LUT-индикатор */}
      {clip.lut ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 rounded-sm bg-black/50 px-1 font-mono text-[8px] uppercase text-white/80 backdrop-blur"
          title={`LUT: ${LUT_BY_ID[clip.lut].name}`}
        >
          LUT
        </span>
      ) : null}

      {/* Переход в начале клипа */}
      {TransitionIcon && width > 30 ? (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1 flex items-center rounded-sm bg-primary/90 px-1 py-px text-primary-foreground"
        >
          <TransitionIcon className="size-2.5" />
        </span>
      ) : null}

      {/* Подпись / текст титра */}
      <span className="absolute inset-0 flex items-center p-1">
        {clip.kind === "title" ? (
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-center text-white/90",
              FONT_CLASS[clip.font ?? "serif"],
            )}
            style={{ fontSize: titleFontSize }}
          >
            {clip.text ?? clip.name}
          </span>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-[10px] font-medium leading-tight text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
              {clip.name}
            </span>
            {width > 64 ? (
              <span className="shrink-0 rounded-sm bg-black/45 px-1 font-mono text-[9px] tabular-nums text-white/85 backdrop-blur">
                {formatDur(clip.duration)}
              </span>
            ) : null}
          </>
        )}
      </span>

      {/* Магнитная привязка */}
      {snapping ? (
        <span aria-hidden="true">
          <span className="absolute inset-y-0 left-0 w-[2px] rounded-l bg-primary/80" />
          <span className="absolute inset-y-0 right-0 w-[2px] rounded-r bg-primary/40" />
        </span>
      ) : null}

      {/* Ручки обрезки */}
      {tool === "trim" && selected ? (
        <span aria-hidden="true">
          <span className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-primary" />
          <span className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-primary" />
        </span>
      ) : null}
    </button>
  );
}
