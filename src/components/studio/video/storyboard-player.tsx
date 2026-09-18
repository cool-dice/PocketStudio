"use client";

/**
 * StoryboardPlayer — плеер сборки «фильма» из сцен раскадровки (Task 5-b).
 *
 * Большой кадр текущей сцены (16:9, на больших экранах — кинематографичный
 * укороченный кадр) + один <audio> на плеер (перезапуск при смене сцены).
 * По окончании аудио — автопереход к следующей сцене; сцена без озвучки
 * живёт NO_AUDIO_SCENE_MS. Управление — нижний оверлей (prev/play/next +
 * прогресс-индекс + подпись «Сцена 2 из 5 — {название}»). Ниже — лента
 * миниатюр (клик = переход). Сцена без кадра — плитка-заглушка с номером
 * и текстом.
 */

import { useCallback, useEffect, useRef } from "react";
import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { NO_AUDIO_SCENE_MS, type VideoScene } from "./video-data";

export interface StoryboardPlayerProps {
  scenes: VideoScene[];
  index: number;
  playing: boolean;
  onIndexChange: (index: number) => void;
  onPlayingChange: (playing: boolean) => void;
}

export function StoryboardPlayer({
  scenes,
  index,
  playing,
  onIndexChange,
  onPlayingChange,
}: StoryboardPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<number | null>(null);
  /** Свежие значения для колбэков аудио/таймера (без stale-замыканий). */
  const latest = useRef({ index, playing, count: scenes.length });
  useEffect(() => {
    latest.current = { index, playing, count: scenes.length };
  });

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Конец сцены: следующая или стоп в конце фильма. */
  const advance = useCallback(() => {
    const { index: at, count } = latest.current;
    if (at + 1 < count) onIndexChange(at + 1);
    else onPlayingChange(false);
  }, [onIndexChange, onPlayingChange]);

  const scene = scenes[index];
  const sceneId = scene?.section.id ?? null;
  const voiceUrl = scene?.voiceUrl ?? null;

  /* Смена сцены/воспроизведения: перезапуск аудио или таймера сцены. */
  useEffect(() => {
    if (!sceneId) return undefined;
    stopTimer();
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      if (voiceUrl) {
        audio.src = voiceUrl;
        audio.currentTime = 0;
      } else {
        audio.removeAttribute("src");
      }
    }
    if (playing) {
      if (voiceUrl && audio) {
        void audio.play().catch(() => onPlayingChange(false));
      } else {
        timerRef.current = window.setTimeout(advance, NO_AUDIO_SCENE_MS);
      }
    }
    return stopTimer;
  }, [sceneId, voiceUrl, playing, advance, stopTimer, onPlayingChange]);

  /* Размонтирование: остановить аудио и таймер. */
  useEffect(
    () => () => {
      audioRef.current?.pause();
      stopTimer();
    },
    [stopTimer],
  );

  const total = scenes.length;
  const caption = scene
    ? `Сцена ${index + 1} из ${total} — ${scene.section.title}`
    : "";

  return (
    <section
      aria-label="Плеер сборки фильма"
      className="flex flex-col gap-2.5"
    >
      {/* Экран + нижний оверлей управления */}
      <div className="relative aspect-video max-h-[34dvh] w-full select-none overflow-hidden rounded-xl border bg-stone-950 shadow-sm">
        {scene?.imageUrl ? (
          <img
            src={scene.imageUrl}
            alt={`Кадр: ${scene.section.title}`}
            className="absolute inset-0 size-full object-cover"
          />
        ) : scene ? (
          <div className="absolute inset-0 flex flex-col items-center gap-1.5 bg-gradient-to-br from-stone-900 via-stone-950 to-black px-6 pb-24 pt-10 text-center">
            <span className="font-mono text-2xl font-semibold text-stone-500">
              {String(index + 1).padStart(2, "0")}
            </span>
            <p className="line-clamp-3 max-w-md text-sm leading-relaxed text-stone-400">
              {scene.section.content.trim() ||
                "Текст сцены пока пуст — напишите его в списке сцен ниже."}
            </p>
            <span className="text-[10px] uppercase tracking-widest text-stone-600">
              кадр не сгенерирован
            </span>
          </div>
        ) : null}

        {/* Виньетка */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(115%_115%_at_50%_42%,transparent_62%,rgba(0,0,0,0.5)_100%)]"
        />

        {/* Центральная кнопка воспроизведения */}
        <button
          type="button"
          onClick={() => onPlayingChange(!playing)}
          aria-label={playing ? "Пауза" : "Воспроизвести фильм"}
          className="absolute left-1/2 top-1/2 z-10 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-background/25 text-white shadow-lg backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:size-16"
        >
          {playing ? (
            <Pause className="size-6" aria-hidden="true" />
          ) : (
            <Play className="size-6 translate-x-0.5" aria-hidden="true" />
          )}
        </button>

        {/* Бейдж сцены */}
        {scene ? (
          <span className="absolute left-3 top-3 z-10 rounded-md border border-white/15 bg-black/50 px-2 py-1 text-[10px] font-medium tracking-[0.16em] text-white/85 backdrop-blur">
            СЦЕНА {index + 1}/{total}
            {scene.voiceUrl ? (
              <Volume2
                className="ml-1.5 inline size-3 align-[-2px]"
                aria-hidden="true"
              />
            ) : null}
          </span>
        ) : null}

        {/* Нижний оверлей: prev/play/next + прогресс + подпись */}
        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2.5 pb-2 pt-8 sm:gap-2.5 sm:px-3">
          <button
            type="button"
            onClick={() => onIndexChange(Math.max(0, index - 1))}
            disabled={index <= 0}
            aria-label="Предыдущая сцена"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
          >
            <SkipBack className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onPlayingChange(!playing)}
            aria-label={playing ? "Пауза" : "Воспроизвести фильм"}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {playing ? (
              <Pause className="size-4" aria-hidden="true" />
            ) : (
              <Play className="size-4 translate-x-px" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onIndexChange(Math.min(total - 1, index + 1))}
            disabled={index >= total - 1}
            aria-label="Следующая сцена"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40"
          >
            <SkipForward className="size-4" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <div
              role="progressbar"
              aria-label="Прогресс фильма по сценам"
              aria-valuemin={1}
              aria-valuemax={total}
              aria-valuenow={total > 0 ? index + 1 : 0}
              className="h-1 w-full overflow-hidden rounded-full bg-white/25"
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${total > 0 ? ((index + 1) / total) * 100 : 0}%` }}
              />
            </div>
            <p
              className="mt-1.5 truncate text-[11px] leading-tight text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]"
              aria-live="polite"
            >
              {caption}
            </p>
          </div>
        </div>
      </div>

      {/* Лента миниатюр сцен */}
      <div className="vf-scroll-x -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {scenes.map((s, i) => (
          <button
            key={s.section.id}
            type="button"
            onClick={() => onIndexChange(i)}
            aria-label={`Перейти к сцене ${i + 1}: ${s.section.title}`}
            aria-current={i === index}
            className={cn(
              "relative h-11 w-[72px] shrink-0 overflow-hidden rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              i === index
                ? "border-primary opacity-100 ring-2 ring-primary/40"
                : "border-border opacity-70 hover:opacity-100",
            )}
          >
            {s.imageUrl ? (
              <img
                src={s.imageUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center bg-stone-900 font-mono text-xs text-stone-500">
                {i + 1}
              </span>
            )}
            {s.voiceUrl ? (
              <span className="absolute bottom-1 right-1 rounded bg-black/60 p-0.5 text-white/90 backdrop-blur">
                <Volume2 className="size-2.5" aria-hidden="true" />
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Единственный аудио-элемент плеера */}
      <audio ref={audioRef} onEnded={advance} preload="auto" className="hidden" />
    </section>
  );
}
