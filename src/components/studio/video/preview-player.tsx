"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

import { CURRENT_SECONDS, type SceneCard } from "./video-data";

/** Рассыпанные звёзды для «космического» кадра. */
const STARS: {
  left: string;
  top: string;
  size: number;
  opacity: number;
}[] = [
  { left: "12%", top: "18%", size: 2, opacity: 0.9 },
  { left: "22%", top: "62%", size: 1, opacity: 0.6 },
  { left: "34%", top: "30%", size: 2, opacity: 0.75 },
  { left: "44%", top: "12%", size: 1, opacity: 0.5 },
  { left: "55%", top: "55%", size: 2, opacity: 0.85 },
  { left: "63%", top: "22%", size: 1, opacity: 0.55 },
  { left: "70%", top: "40%", size: 2, opacity: 0.7 },
  { left: "84%", top: "16%", size: 1, opacity: 0.6 },
  { left: "90%", top: "48%", size: 2, opacity: 0.8 },
];

function badgeClass(extra?: string) {
  return cn(
    "pointer-events-none absolute z-10 rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-medium tracking-wide text-white/90 backdrop-blur",
    extra,
  );
}

/**
 * Кинематографичный превью-плеер: градиентный кадр активной сцены,
 * виньетка, плёночное зерно и стеклянная кнопка воспроизведения.
 */
export function PreviewPlayer({
  playing,
  onTogglePlaying,
  scene,
}: {
  playing: boolean;
  onTogglePlaying: () => void;
  scene: SceneCard;
}) {
  const seconds = String(Math.floor(CURRENT_SECONDS)).padStart(2, "0");

  return (
    <div className="relative aspect-video w-full select-none overflow-hidden rounded-xl border bg-stone-950 shadow-sm">
      {/* Кадр сцены */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-gradient-to-br transition-all duration-700",
          scene.gradient,
        )}
      />
      {/* Изумрудные свечения */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(55%_60%_at_28%_22%,var(--primary)_0%,transparent_62%)] opacity-25"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(45%_45%_at_78%_78%,var(--primary)_0%,transparent_70%)] opacity-15"
      />
      {/* Планета и луна */}
      <span
        aria-hidden="true"
        className="absolute right-[16%] top-[24%] size-24 rounded-full bg-[radial-gradient(circle_at_32%_28%,var(--primary)_0%,transparent_58%)] opacity-60 ring-1 ring-white/10 sm:size-28"
      />
      <span
        aria-hidden="true"
        className="absolute left-[18%] top-[48%] size-2.5 rounded-full bg-white/25"
      />
      {/* Звёзды */}
      {STARS.map((star, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "absolute rounded-full bg-white/80",
            playing && "animate-pulse",
          )}
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animationDelay: `${i * 0.35}s`,
          }}
        />
      ))}
      {/* Горизонт */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent"
      />
      {/* Виньетка */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(115%_115%_at_50%_42%,transparent_58%,rgba(0,0,0,0.55)_100%)]"
      />
      {/* Плёночное зерно */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.9) 0.5px, transparent 0.6px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* Угловые бейджи */}
      <span className={badgeClass("left-3 top-3")}>
        <span className="inline-flex items-center gap-1.5 tracking-[0.18em]">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full bg-primary",
              playing && "animate-pulse",
            )}
          />
          ПРЕВЬЮ
        </span>
      </span>
      <span className={badgeClass("right-3 top-3 font-mono tabular-nums")}>
        1080p · 16:9
      </span>
      <span
        className={cn(
          badgeClass("bottom-3 left-3 font-mono tabular-nums tracking-wide"),
          playing && "animate-pulse",
        )}
      >
        00:00:{seconds}:12
      </span>
      <span className={badgeClass("bottom-3 right-3 font-mono tabular-nums")}>
        СЦЕНА {String(scene.id).padStart(2, "0")}/08
      </span>

      {/* Воспроизведение */}
      <button
        type="button"
        onClick={onTogglePlaying}
        aria-label={playing ? "Поставить на паузу" : "Воспроизвести превью"}
        className="absolute left-1/2 top-1/2 z-10 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-background/20 text-white shadow-lg backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={playing ? "pause" : "play"}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="flex"
          >
            {playing ? (
              <Pause className="size-7" aria-hidden="true" />
            ) : (
              <Play className="size-7 translate-x-0.5" aria-hidden="true" />
            )}
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
