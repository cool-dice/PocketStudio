"use client";

import { useState } from "react";

import { AudioLines, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import { AUDIO_LAYERS } from "./video-data";

interface LayerState {
  id: string;
  kind: string;
  name: string;
  detail: string;
  volume: number;
  muted: boolean;
}

/** Высоты столбиков индикатора мастера, %. */
const METER = [22, 38, 52, 66, 78, 88, 94, 90, 96, 74, 58, 40, 62, 34, 48, 26];

/**
 * Таб «Звук»: слои (музыка / голос / шумы) с мьют-тумблерами и
 * слайдерами громкости + вертикальный индикатор мастера.
 */
export function SoundTab({ playing }: { playing: boolean }) {
  const [layers, setLayers] = useState<LayerState[]>(() =>
    AUDIO_LAYERS.map((l) => ({
      id: l.id,
      kind: l.kind,
      name: l.name,
      detail: l.detail,
      volume: l.volume,
      muted: false,
    })),
  );

  const toggleMute = (id: string) =>
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, muted: !l.muted } : l)),
    );

  const setVolume = (id: string, value: number) =>
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, volume: value } : l)),
    );

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Слои звука
        </h3>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {layers.length} слоя · −14 LUFS
        </span>
      </header>

      <ul className="space-y-2.5">
        {layers.map((layer) => (
          <li key={layer.id} className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground"
              >
                <AudioLines className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {layer.kind}: {layer.name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {layer.detail}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => toggleMute(layer.id)}
                aria-label={
                  layer.muted
                    ? `Включить слой «${layer.kind}»`
                    : `Заглушить слой «${layer.kind}»`
                }
              >
                {layer.muted ? (
                  <VolumeX
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                ) : (
                  <Volume2
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                )}
              </Button>
            </div>
            <div className="mt-2.5 flex items-center gap-2.5">
              <Slider
                value={[layer.volume]}
                onValueChange={(v) => setVolume(layer.id, v[0] ?? 0)}
                disabled={layer.muted}
                aria-label={`Громкость слоя «${layer.kind}»`}
                className="min-w-0 flex-1"
              />
              <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {layer.muted ? "—" : `${layer.volume}%`}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold">
            <AudioLines
              className="size-3.5 text-primary"
              aria-hidden="true"
            />
            Мастер
          </h4>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            −12 дБ
          </span>
        </div>
        <div
          role="img"
          aria-label="Индикатор уровня громкости мастера"
          className="flex h-14 items-end justify-between gap-1"
        >
          {METER.map((h, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={cn(
                "w-full rounded-sm transition-opacity",
                i > 12
                  ? "bg-amber-500/80"
                  : i > 8
                    ? "bg-primary"
                    : "bg-primary/60",
                playing && i % 4 === 1 && "animate-pulse",
              )}
              style={{
                height: `${h}%`,
                animationDelay: `${i * 90}ms`,
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
