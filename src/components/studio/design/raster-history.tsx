"use client";

/**
 * Панели «ФИЛЬТРЫ» и «ИСТОРИЯ» режима «Растр»: слайдеры яркости/контраста/
 * насыщенности, Ч/Б, LUT-пресеты-плитки и кликабельная история операций.
 */

import { Contrast, History } from "lucide-react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  LUT_PRESETS,
  type HistoryItem,
  type LutPreset,
  type RasterFilters,
} from "./design-data";
import { SectionHeader } from "./raster-panels";

/* ────────────────────────── ФИЛЬТРЫ ────────────────────────── */

/** Патч состояния для записи в историю (фрагмент снимка растра). */
export interface HistoryPatch {
  filters?: Partial<RasterFilters>;
  lutId?: string | null;
}

export function FiltersPanel({
  filters,
  onFilters,
  onCommit,
  activeLut,
  onLut,
}: {
  filters: RasterFilters;
  onFilters: (patch: Partial<RasterFilters>) => void;
  onCommit: (label: string, patch?: HistoryPatch) => void;
  activeLut: string | null;
  onLut: (id: string | null) => void;
}) {
  const filterSlider = (
    id: "brightness" | "contrast" | "saturate",
    label: string,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={`f-${id}`} className="text-xs">
          {label}
        </Label>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {filters[id]}%
        </span>
      </div>
      <Slider
        id={`f-${id}`}
        value={[filters[id]]}
        min={0}
        max={200}
        step={1}
        onValueChange={([v]) =>
          onFilters({ [id]: v } as Partial<RasterFilters>)
        }
        onValueCommit={([v]) =>
          onCommit(`${label} → ${v}`, { filters: { [id]: v } })
        }
        aria-label={label}
      />
    </div>
  );

  return (
    <section aria-label="Фильтры" className="border-t">
      <SectionHeader icon={Contrast} title="Фильтры" />
      <div className="space-y-4 px-3 pb-4">
        {filterSlider("brightness", "Яркость")}
        {filterSlider("contrast", "Контраст")}
        {filterSlider("saturate", "Насыщенность")}
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="grayscale-switch" className="text-xs">
            Ч / Б
          </Label>
          <Switch
            id="grayscale-switch"
            checked={filters.grayscale}
            onCheckedChange={(checked) => {
              onFilters({ grayscale: checked });
              onCommit(checked ? "Ч/Б включён" : "Ч/Б выключен", {
                filters: { grayscale: checked },
              });
            }}
          />
        </div>
        <div className="space-y-2">
          <p className="text-xs">Пресеты цвета (LUT)</p>
          <div className="grid grid-cols-4 gap-2">
            {LUT_PRESETS.map((lut) => (
              <LutTile
                key={lut.id}
                lut={lut}
                active={activeLut === lut.id}
                onToggle={() => {
                  const next = activeLut === lut.id ? null : lut.id;
                  onLut(next);
                  onCommit(
                    next ? `LUT: ${lut.name}` : "LUT сброшен",
                    { lutId: next },
                  );
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LutTile({
  lut,
  active,
  onToggle,
}: {
  lut: LutPreset;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={active}
          aria-label={`LUT-пресет «${lut.name}»`}
          className={cn(
            "group flex flex-col items-center gap-1 rounded-lg border p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
            active
              ? "border-primary/60 bg-primary/10"
              : "border-transparent hover:bg-accent/60",
          )}
        >
          <span
            className="h-8 w-full rounded-md shadow-inner"
            style={{ background: lut.tileCss }}
            aria-hidden="true"
          />
          <span
            className={cn(
              "text-[10px] leading-none",
              active ? "font-medium text-primary" : "text-muted-foreground",
            )}
          >
            {lut.name}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">Пресет «{lut.name}»</TooltipContent>
    </Tooltip>
  );
}

/* ────────────────────────── ИСТОРИЯ ────────────────────────── */

export function HistoryPanel({
  history,
  activeIndex,
  onSelect,
}: {
  history: HistoryItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <section aria-label="История" className="border-t">
      <SectionHeader icon={History} title="История">
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {activeIndex + 1} / {history.length}
        </span>
      </SectionHeader>
      <ol className="space-y-0.5 px-2 pb-4">
        {history.map((item, index) => {
          const active = index === activeIndex;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border"
                  aria-hidden="true"
                >
                  <item.icon className="size-3" />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
