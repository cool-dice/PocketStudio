"use client";

/**
 * StyleTab (Фаза A) — вкладка «Стиль» дизайн-модуля: карта палитры
 * на живом артефакте (stage "style", meta.kind "palette") + форма
 * «Собрать палитру» с брифом → POST /api/ai/palette (~10–20 секунд).
 */

import { useRef, useState } from "react";
import { Loader2, Palette as PaletteIcon, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { StylePalette } from "@/lib/palette";
import { SelectableChip } from "../images/chip";
import { PaletteCard } from "./palette-card";
import { SAMPLE_BRIEFS } from "./palette-data";

export interface LoadedPalette {
  palette: StylePalette;
  createdAt: string;
  brief: string | null;
}

export function StyleTab({
  loaded,
  loading,
  busy,
  onGenerate,
}: {
  /** Текущая палитра воркспейса (последняя по дате) или null. */
  loaded: LoadedPalette | null;
  loading: boolean;
  busy: boolean;
  onGenerate: (brief: string) => void;
}) {
  const [brief, setBrief] = useState("");
  const briefRef = useRef<HTMLTextAreaElement | null>(null);

  const submit = () => {
    if (busy) return;
    onGenerate(brief.trim());
  };

  const focusBrief = () => {
    briefRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    briefRef.current?.focus();
  };

  return (
    <div
      aria-label="Стиль"
      className="vf-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1"
    >
      {/* Карта палитры / пустое состояние / скелетон */}
      {loading && !loaded ? (
        <div
          aria-label="Палитра загружается"
          className="space-y-4 rounded-xl border bg-card p-4 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="h-2.5 w-3/4 rounded" />
              </div>
            ))}
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : loaded ? (
        <PaletteCard
          palette={loaded.palette}
          createdAt={loaded.createdAt}
          brief={loaded.brief}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
          <PaletteIcon
            className="size-8 text-muted-foreground/50"
            aria-hidden="true"
          />
          <div className="max-w-md">
            <p className="text-sm font-medium">Палитры стиля пока нет</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Опишите настроение и референсы в брифе ниже — модель соберёт
              5–6 цветов, пару шрифтов и короткий совет по стилю. Палитра
              сохранится в воркспейсе и обновит эту карту.
            </p>
          </div>
          <Button size="sm" onClick={focusBrief}>
            <Sparkles className="size-4" aria-hidden="true" />
            Собрать палитру
          </Button>
        </div>
      )}

      {/* Форма: бриф → POST /api/ai/palette */}
      <section
        aria-label="Собрать палитру"
        className="shrink-0 rounded-xl border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="palette-brief" className="text-sm font-medium">
            {loaded ? "Пересобрать палитру" : "Бриф стиля"}
          </label>
          <span className="text-xs text-muted-foreground">
            Воркспейс + бриф → 5–6 цветов и пара шрифтов
          </span>
        </div>
        <Textarea
          id="palette-brief"
          ref={briefRef}
          rows={3}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Например: «кинематографичный триллер, холодные тени, один тёплый акцент — цвет фонаря в тумане»…"
          className="mt-2 resize-none"
          disabled={busy}
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Идеи:
          </span>
          {SAMPLE_BRIEFS.map((s) => (
            <SelectableChip
              key={s.label}
              label={s.label}
              selected={brief === s.brief}
              onClick={() => setBrief(brief === s.brief ? "" : s.brief)}
              disabled={busy}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3">
          <Button onClick={submit} disabled={busy} aria-live="polite">
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <PaletteIcon className="size-4" aria-hidden="true" />
            )}
            {busy ? "Модель подбирает цвета…" : "Собрать палитру"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Обычно это занимает 10–20 секунд
          </p>
        </div>

        {busy ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.06]"
          >
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
                aria-hidden="true"
              >
                <Sparkles className="size-4 animate-pulse" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  Модель читает бриф и подбирает цвета…
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {brief.trim()
                    ? `«${brief.trim()}»`
                    : "по названию и описанию воркспейса"}
                </p>
              </div>
            </div>
            <div className="h-1 w-full overflow-hidden bg-primary/10">
              <div className="h-full w-1/3 animate-pulse bg-primary/50" />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
