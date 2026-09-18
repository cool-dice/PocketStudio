"use client";

/**
 * Правая панель режима «Растр»: СЛОИ и СВОЙСТВА ИНСТРУМЕНТА.
 * Фильтры и история — в raster-history.tsx.
 * Все правки локальные — состояние живёт в raster-tab.
 */

import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Layers,
  Lock,
  LockOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  FILL_PALETTE,
  type BrushSettings,
  type RasterLayerDef,
  type RasterTool,
} from "./design-data";

/* ────────────────────────── Общая шапка секции ────────────────────────── */

export function SectionHeader({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children ? (
        <span className="ml-auto flex items-center gap-1">{children}</span>
      ) : null}
    </div>
  );
}

/* ────────────────────────── СЛОИ ────────────────────────── */

export function LayersPanel({
  layers,
  activeId,
  onSelect,
  onToggleVisible,
  onToggleLock,
  onOpacity,
  onMove,
}: {
  layers: RasterLayerDef[];
  activeId: string;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onOpacity: (id: string, value: number) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  return (
    <section aria-label="Слои">
      <SectionHeader icon={Layers} title={`Слои · ${layers.length}`}>
        <span className="text-[10px] text-muted-foreground">
          сверху вниз
        </span>
      </SectionHeader>
      <ul className="space-y-1 px-2 pb-3">
        {layers.map((layer, index) => {
          const active = layer.id === activeId;
          return (
            <li
              key={layer.id}
              className={cn(
                "rounded-lg border border-transparent px-2 py-1.5 transition-colors",
                active
                  ? "border-primary/40 bg-primary/10"
                  : "hover:bg-accent/50",
              )}
            >
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={() => onToggleVisible(layer.id)}
                  aria-label={
                    layer.visible
                      ? `Скрыть слой «${layer.name}»`
                      : `Показать слой «${layer.name}»`
                  }
                >
                  {layer.visible ? (
                    <Eye className="size-3.5" aria-hidden="true" />
                  ) : (
                    <EyeOff
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => onSelect(layer.id)}
                  aria-current={active ? "true" : undefined}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <layer.icon
                    className={cn(
                      "size-3.5 shrink-0",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "truncate text-xs",
                      active ? "font-medium" : "font-normal",
                      !layer.visible && "text-muted-foreground/60 line-through",
                    )}
                  >
                    {layer.name}
                  </span>
                </button>
                <span className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => onToggleLock(layer.id)}
                    aria-label={
                      layer.locked
                        ? `Разблокировать слой «${layer.name}»`
                        : `Заблокировать слой «${layer.name}»`
                    }
                  >
                    {layer.locked ? (
                      <Lock
                        className="size-3.5 text-amber-600 dark:text-amber-400"
                        aria-hidden="true"
                      />
                    ) : (
                      <LockOpen
                        className="size-3.5 text-muted-foreground/70"
                        aria-hidden="true"
                      />
                    )}
                  </Button>
                  <span className="flex flex-col">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5"
                      disabled={index === 0 || layer.locked}
                      onClick={() => onMove(layer.id, -1)}
                      aria-label={`Поднять слой «${layer.name}»`}
                    >
                      <ArrowUp className="size-3" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5"
                      disabled={index === layers.length - 1 || layer.locked}
                      onClick={() => onMove(layer.id, 1)}
                      aria-label={`Опустить слой «${layer.name}»`}
                    >
                      <ArrowDown className="size-3" aria-hidden="true" />
                    </Button>
                  </span>
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 pl-1">
                <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                  {layer.opacity}%
                </span>
                <Slider
                  value={[layer.opacity]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([v]) => onOpacity(layer.id, v)}
                  className="flex-1"
                  aria-label={`Прозрачность слоя «${layer.name}»`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ────────────────────── СВОЙСТВА ИНСТРУМЕНТА ────────────────────── */

export function ToolPanel({
  tool,
  brush,
  onBrush,
}: {
  tool: RasterTool;
  brush: BrushSettings;
  onBrush: (patch: Partial<BrushSettings>) => void;
}) {
  const colorIndex = FILL_PALETTE.indexOf(brush.color);
  const nextColor =
    FILL_PALETTE[(colorIndex + 1 + FILL_PALETTE.length) % FILL_PALETTE.length] ??
    FILL_PALETTE[0];
  return (
    <section aria-label="Свойства инструмента" className="border-t">
      <SectionHeader icon={tool.icon} title={`Свойства · ${tool.name}`}>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {tool.hotkey}
        </kbd>
      </SectionHeader>
      <div className="space-y-4 px-3 pb-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="brush-size" className="text-xs">
              Размер
            </Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {brush.size} px
            </span>
          </div>
          <Slider
            id="brush-size"
            value={[brush.size]}
            min={1}
            max={200}
            step={1}
            onValueChange={([v]) => onBrush({ size: v })}
            aria-label="Размер кисти"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="brush-hardness" className="text-xs">
              Жёсткость
            </Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {brush.hardness}%
            </span>
          </div>
          <Slider
            id="brush-hardness"
            value={[brush.hardness]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onBrush({ hardness: v })}
            aria-label="Жёсткость кисти"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs">Цвет</span>
          <button
            type="button"
            className="size-7 rounded-md border shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            style={{ background: brush.color }}
            aria-label="Сменить цвет кисти"
            title="Клик — следующий цвет палитры"
            onClick={() => onBrush({ color: nextColor })}
          />
          <span className="font-mono text-xs text-muted-foreground">
            {brush.color}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────── Мини-бейдж «В разработке» ──────────────────── */

export function WipMiniBadge({ label = "В разработке" }: { label?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
      {label}
    </span>
  );
}
