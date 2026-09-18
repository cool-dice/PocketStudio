"use client";

/**
 * «СОБРАТЬ ФИЛЬМ»: диалог с 5-шаговым пайплайном сборки (анимация ~1 с
 * на шаг) и карточкой результата + диалог превью собранного фильма.
 */

import { useEffect, useState } from "react";

import { Check, Loader2, Pause, Play, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import {
  ASSEMBLE_STEPS,
  FILM_SECONDS,
  FILM_SUBTITLE,
  FILM_TITLE,
  formatDur,
  formatTc,
} from "./nle-data";

/* ── Диалог сборки ──────────────────────────────────────────────────── */

export function AssembleDialog({
  open,
  onOpenChange,
  onFinished,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Вызывается, когда собранный фильм «получен» — чип в тулбаре. */
  onFinished: () => void;
  onPreview: () => void;
}) {
  const [step, setStep] = useState(0);
  const total = ASSEMBLE_STEPS.length;
  const done = step >= total;

  useEffect(() => {
    if (!open || done) return;
    const timer = window.setTimeout(() => setStep((s) => s + 1), 900);
    return () => window.clearTimeout(timer);
  }, [open, done, step]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            Сборка фильма
          </DialogTitle>
          <DialogDescription>
            {FILM_TITLE} · часть I · {formatDur(FILM_SECONDS)}
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <div className="space-y-4">
            {/* Общий прогресс */}
            <div
              role="progressbar"
              aria-label="Прогресс сборки"
              aria-valuenow={step}
              aria-valuemin={0}
              aria-valuemax={total}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-linear"
                style={{ width: `${(step / total) * 100}%` }}
              />
            </div>

            <ol className="space-y-2.5">
              {ASSEMBLE_STEPS.map((s, i) => {
                const state = i < step ? "done" : i === step ? "active" : "pending";
                const Icon = s.icon;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-2.5 transition-colors",
                      state === "active" && "border-primary/50 bg-primary/5",
                      state === "done" && "border-border bg-muted/30",
                      state === "pending" && "border-dashed border-border/70",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full border",
                        state === "done" &&
                          "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        state === "active" && "border-primary bg-primary/10 text-primary",
                        state === "pending" && "border-border text-muted-foreground/50",
                      )}
                    >
                      {state === "done" ? (
                        <Check className="size-4" aria-hidden="true" />
                      ) : state === "active" ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Icon className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-sm font-medium leading-tight",
                          state === "pending" && "text-muted-foreground",
                        )}
                      >
                        {s.label}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.detail}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-[11px] font-medium",
                        state === "done" && "text-emerald-600 dark:text-emerald-400",
                        state === "active" && "text-primary",
                        state === "pending" && "text-muted-foreground/60",
                      )}
                    >
                      {state === "done" ? "Готово" : state === "active" ? "В работе" : "Ожидает"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Результат */}
            <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] px-4 py-5 text-center">
              <span className="flex size-11 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check className="size-5" aria-hidden="true" />
              </span>
              <p className="text-base font-semibold">Фильм собран — {formatDur(FILM_SECONDS)}</p>
              <p className="text-xs text-muted-foreground">
                Черновой монтаж прошёл цветокор, звук и титры
              </p>
              <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Параметры файла">
                {["1080p", "H.264", "24 к/с", "≈ 1,2 ГБ"].map((chip) => (
                  <li
                    key={chip}
                    className="rounded-full border bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => {
                  onFinished();
                  onOpenChange(false);
                  onPreview();
                }}
              >
                <Play aria-hidden="true" />
                Открыть превью
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="min-w-0 flex-1" disabled>
                  Опубликовать
                </Button>
                <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  В разработке
                </span>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  onFinished();
                  onOpenChange(false);
                }}
              >
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Превью собранного фильма ──────────────────────────────────────── */

export function FilmPreviewDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(24.4);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPos((p) => (p + 0.25 >= FILM_SECONDS ? 0 : p + 0.25));
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setPlaying(false);
      setPos(24.4);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Превью фильма</DialogTitle>
          <DialogDescription>
            Собранный черновик · {formatDur(FILM_SECONDS)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <div className="relative aspect-video w-full select-none overflow-hidden rounded-xl border bg-stone-950">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-amber-200 via-rose-300 to-teal-700"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(115%_115%_at_50%_42%,transparent_55%,rgba(0,0,0,0.55)_100%)]"
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="font-serif text-2xl font-semibold tracking-[0.14em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.8)] sm:text-4xl">
                {FILM_TITLE}
              </p>
              <p className="text-xs text-white/75 sm:text-sm">{FILM_SUBTITLE}</p>
            </div>
            <span className="absolute left-3 top-3 rounded-md border border-white/15 bg-black/45 px-2 py-1 text-[10px] font-medium tracking-[0.18em] text-white/90 backdrop-blur">
              СОБРАННЫЙ ЧЕРНОВИК
            </span>
            <span className="absolute bottom-3 left-3 rounded-md border border-white/15 bg-black/45 px-2 py-1 font-mono text-[10px] tabular-nums text-white/90 backdrop-blur">
              {formatTc(pos)}
            </span>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Поставить на паузу" : "Воспроизвести фильм"}
              className="absolute left-1/2 top-1/2 z-10 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-background/20 text-white shadow-lg backdrop-blur transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              {playing ? (
                <Pause className="size-6" aria-hidden="true" />
              ) : (
                <Play className="size-6 translate-x-0.5" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Прогресс */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatDur(pos)}
            </span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-primary transition-[width] duration-200 ease-linear",
                )}
                style={{ width: `${(pos / FILM_SECONDS) * 100}%` }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {formatDur(FILM_SECONDS)}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
