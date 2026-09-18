"use client";

/**
 * ИНСПЕКТОР КЛИПА: свойства выбранного клипа — скорость (пересчитывает
 * длительность), LUT-плитки цветокора, переходы и редактор титров
 * (текст/шрифт/размер/позиция — мутируют клип вживую).
 */

import { Check, MousePointer, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import {
  CLIP_KIND_LABEL,
  FONT_OPTIONS,
  formatDur,
  formatTc,
  LUTS,
  LUT_BY_ID,
  TRACK_BY_ID,
  TRANSITIONS,
  type LutId,
  type NleClip,
  type TitlePosition,
  type TransitionId,
} from "./nle-data";

const POSITION_LABEL: Record<TitlePosition, string> = {
  top: "Верх",
  center: "Центр",
  bottom: "Низ",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="shrink-0 text-[11px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-mono text-[11px] tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export function ClipInspector({
  clip,
  onSpeed,
  onLut,
  onTransition,
  onTitleText,
  onTitleProps,
  onRemove,
}: {
  clip: NleClip | null;
  onSpeed: (id: string, speed: number) => void;
  onLut: (id: string, lut: LutId | null) => void;
  onTransition: (id: string, transition: TransitionId | null) => void;
  onTitleText: (id: string, text: string) => void;
  onTitleProps: (id: string, patch: { font?: NleClip["font"]; size?: number; position?: TitlePosition }) => void;
  onRemove: () => void;
}) {
  if (!clip) {
    return (
      <section
        aria-label="Инспектор клипа"
        className="flex min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-3"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Инспектор клипа
        </h3>
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-3 py-8 text-center">
          <MousePointer className="size-5 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            Выберите клип на таймлайне
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Скорость, цветокор, переходы и титры появятся здесь
          </p>
        </div>
      </section>
    );
  }

  const track = TRACK_BY_ID[clip.trackId];
  const isVisual = clip.kind === "video" || clip.kind === "image";
  const isVideoTrack = clip.trackId === "v1" || clip.trackId === "v2";
  const lutFilter = clip.lut ? LUT_BY_ID[clip.lut].filter : null;

  return (
    <section
      aria-label="Инспектор клипа"
      className="ps2d-nle-inspector-card flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 lg:grid lg:grid-cols-2 lg:items-start"
    >
      <div className="flex min-w-0 items-center gap-2 px-0.5 lg:col-span-2">
        <span
          aria-hidden="true"
          style={lutFilter ? { filter: lutFilter } : undefined}
          className={cn(
            "size-8 shrink-0 rounded-md bg-gradient-to-br transition-[filter] duration-300",
            clip.gradient,
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold" title={clip.name}>
            {clip.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {CLIP_KIND_LABEL[clip.kind]} · {track.label}
          </p>
        </div>
      </div>

      <dl className="space-y-1.5 rounded-lg border bg-background/50 p-2.5">
        <InfoRow label="Начало" value={formatTc(clip.start)} />
        <InfoRow label="Длительность" value={formatDur(clip.duration)} />
        <InfoRow
          label="In / Out"
          value={`${formatTc(clip.inPoint)} → ${formatTc(clip.inPoint + clip.duration)}`}
        />
        <InfoRow label="Скорость" value={`${clip.speed.toFixed(2)}×`} />
      </dl>

      {/* Скорость */}
      {clip.kind !== "title" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <SectionTitle>Скорость</SectionTitle>
            <span className="font-mono text-[11px] tabular-nums text-primary">
              {clip.speed.toFixed(2)}×
            </span>
          </div>
          <Slider
            value={[clip.speed]}
            min={0.25}
            max={2}
            step={0.05}
            onValueChange={(v) => onSpeed(clip.id, v[0] ?? 1)}
            aria-label="Скорость клипа"
          />
          <div className="flex justify-between font-mono text-[9px] tabular-nums text-muted-foreground/70">
            <span>0.25×</span>
            <span>1×</span>
            <span>2×</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Длительность клипа на таймлайне пересчитывается автоматически.
          </p>
        </div>
      ) : null}

      {/* Эффекты: LUT-плитки */}
      {isVisual ? (
        <div className="space-y-2">
          <SectionTitle>Эффекты · цветокор</SectionTitle>
          <div className="grid grid-cols-5 gap-1.5">
            {LUTS.map((lut) => {
              const active = clip.lut === lut.id;
              return (
                <button
                  key={lut.id}
                  type="button"
                  onClick={() => onLut(clip.id, active ? null : lut.id)}
                  aria-pressed={active}
                  aria-label={`LUT «${lut.name}»`}
                  className={cn(
                    "group flex flex-col items-center gap-1 rounded-md border p-1 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <span className="relative block w-full overflow-hidden rounded-sm">
                    <span
                      aria-hidden="true"
                      className={cn("block aspect-square w-full bg-gradient-to-br", lut.gradient)}
                    />
                    {active ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Check className="size-3 text-white" aria-hidden="true" />
                      </span>
                    ) : null}
                  </span>
                  <span className="w-full truncate text-center text-[9px] leading-none text-muted-foreground">
                    {lut.name}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            LUT применяется к миниатюре клипа и программному монитору.
          </p>
        </div>
      ) : null}

      {/* Переходы */}
      {isVideoTrack ? (
        <div className="space-y-2">
          <SectionTitle>Переход в начале клипа</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {TRANSITIONS.map((tr) => {
              const TIcon = tr.icon;
              const active = clip.transition === tr.id;
              return (
                <button
                  key={tr.id}
                  type="button"
                  onClick={() => onTransition(clip.id, active ? null : tr.id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  )}
                >
                  <TIcon className="size-3.5" aria-hidden="true" />
                  {tr.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Титры */}
      {clip.kind === "title" ? (
        <div className="space-y-2.5">
          <SectionTitle>Титр</SectionTitle>
          <Input
            value={clip.text ?? ""}
            onChange={(e) => onTitleText(clip.id, e.target.value)}
            placeholder="Текст титра"
            aria-label="Текст титра"
            className="h-8 text-xs"
          />
          <Select
            value={clip.font ?? "serif"}
            onValueChange={(v) => onTitleProps(clip.id, { font: v as NleClip["font"] })}
          >
            <SelectTrigger size="sm" aria-label="Шрифт титра" className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-xs">
                  <span className={f.className}>{f.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Slider
              value={[clip.size ?? 32]}
              min={16}
              max={72}
              step={1}
              onValueChange={(v) => onTitleProps(clip.id, { size: v[0] ?? 32 })}
              aria-label="Размер шрифта титра"
              className="min-w-0 flex-1"
            />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
              {clip.size ?? 32}px
            </span>
          </div>
          <div className="flex gap-1" role="group" aria-label="Позиция титра">
            {(Object.keys(POSITION_LABEL) as TitlePosition[]).map((pos) => {
              const active = (clip.position ?? "center") === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() => onTitleProps(clip.id, { position: pos })}
                  aria-pressed={active}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1 text-[11px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50",
                  )}
                >
                  {POSITION_LABEL[pos]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Правки сразу видны на мониторе и в превью таймлайна.
          </p>
        </div>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        onClick={onRemove}
        className="w-full gap-1.5 text-destructive hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive lg:col-span-2"
      >
        <Trash2 aria-hidden="true" />
        Удалить клип
      </Button>
    </section>
  );
}
