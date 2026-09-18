"use client";

/**
 * Инспектор режима «Макет» (Figma-lite): x/y/w/h, заливка, радиус, тень,
 * шрифт и выравнивание выбранного элемента. Правки живут в layout-tab.
 */

import {
  AlignCenter,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  Layers,
  MousePointerClick,
  Shapes,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FILL_PALETTE } from "./design-data";
import {
  FONT_FAMILIES,
  FONT_WEIGHTS,
  type LayoutFrame,
  type LayoutNode,
  type NodeFont,
} from "./layout-data";

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 pt-3 pb-2">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 transition-colors focus-within:ring-2 focus-within:ring-ring/60">
      <span className="w-3 shrink-0 text-[10px] font-medium uppercase text-muted-foreground">
        {label}
      </span>
      <input
        type="number"
        value={Math.round(value)}
        min={0}
        step={step}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v) && e.target.value !== "") onChange(v);
        }}
        aria-label={`${label}: числовое поле`}
        className="h-full w-full min-w-0 bg-transparent text-right font-mono text-xs tabular-nums outline-none"
      />
    </label>
  );
}

export function LayoutInspector({
  node,
  frame,
  onChange,
  onAlign,
}: {
  node: LayoutNode | null;
  frame: LayoutFrame | null;
  onChange: (patch: Partial<LayoutNode>) => void;
  onAlign: (dir: "left" | "center" | "right") => void;
}) {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-full border bg-muted/50 text-muted-foreground"
          aria-hidden="true"
        >
          <MousePointerClick className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium">Выберите элемент на макете</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Кликните по блоку фрейма — здесь появятся его размеры, заливка,
            радиус, тень и шрифт.
          </p>
        </div>
      </div>
    );
  }

  const fillIndex = FILL_PALETTE.indexOf(node.fill);
  const nextFill = FILL_PALETTE[(fillIndex + 1) % FILL_PALETTE.length] ?? FILL_PALETTE[0];
  const setFont = (patch: Partial<NodeFont>) => {
    if (!node.font) return;
    onChange({ font: { ...node.font, ...patch } });
  };

  return (
    <div className="vf-scroll h-full overflow-y-auto pb-4">
      {/* Заголовок элемента */}
      <div className="flex items-center gap-2 border-b px-3 py-3">
        <span
          className="size-3.5 shrink-0 rounded-[4px] border border-border"
          style={{ background: node.fill === "transparent" ? undefined : node.fill }}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {node.name}
        </p>
        <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {node.tag}
        </code>
      </div>

      {/* Размеры и позиция */}
      <section aria-label="Размеры и позиция">
        <SectionTitle icon={Shapes} title="Размеры и позиция" />
        <div className="grid grid-cols-2 gap-2 px-3">
          <NumberField label="X" value={node.x} onChange={(x) => onChange({ x })} step={8} />
          <NumberField label="Y" value={node.y} onChange={(y) => onChange({ y })} step={8} />
          <NumberField label="Ш" value={node.w} onChange={(w) => onChange({ w })} step={8} />
          <NumberField label="В" value={node.h} onChange={(h) => onChange({ h })} step={8} />
        </div>
        {frame ? (
          <p className="px-3 pt-1.5 text-[10px] text-muted-foreground">
            Фрейм «{frame.name}» · {frame.width} × {frame.height}
          </p>
        ) : null}
      </section>

      {/* Заливка и скругление */}
      <section aria-label="Заливка и скругление">
        <SectionTitle icon={Layers} title="Заливка и скругление" />
        <div className="space-y-3 px-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange({ fill: nextFill })}
              aria-label="Сменить цвет заливки"
              title="Клик — следующий цвет палитры"
              className="size-8 shrink-0 rounded-md border shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              style={{ background: node.fill === "transparent" ? undefined : node.fill }}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {node.fill}
            </span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="node-radius" className="text-xs">
                Радиус
              </Label>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {node.radius} px
              </span>
            </div>
            <Slider
              id="node-radius"
              value={[node.radius]}
              min={0}
              max={40}
              step={1}
              onValueChange={([radius]) => onChange({ radius })}
              aria-label="Радиус скругления"
            />
          </div>
        </div>
      </section>

      {/* Тень */}
      <section aria-label="Тень">
        <SectionTitle icon={Layers} title="Тень" />
        <div className="space-y-3 px-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="node-shadow" className="text-xs">
              Тень элемента
            </Label>
            <Switch
              id="node-shadow"
              checked={node.shadow}
              onCheckedChange={(shadow) => onChange({ shadow })}
            />
          </div>
          <div
            className={cn(
              "space-y-2 transition-opacity",
              !node.shadow && "pointer-events-none opacity-40",
            )}
          >
            <div className="flex items-center justify-between">
              <Label htmlFor="node-shadow-blur" className="text-xs">
                Размытие
              </Label>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {node.shadowBlur} px
              </span>
            </div>
            <Slider
              id="node-shadow-blur"
              value={[node.shadowBlur]}
              min={0}
              max={60}
              step={2}
              onValueChange={([shadowBlur]) => onChange({ shadowBlur })}
              aria-label="Размытие тени"
            />
          </div>
        </div>
      </section>

      {/* Шрифт */}
      {node.font ? (
        <section aria-label="Шрифт">
          <SectionTitle icon={Shapes} title="Шрифт" />
          <div className="space-y-3 px-3">
            <Select
              value={node.font.family}
              onValueChange={(family) => setFont({ family })}
            >
              <SelectTrigger className="h-8 text-xs" aria-label="Гарнитура">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="px"
                value={node.font.size}
                onChange={(size) => setFont({ size })}
              />
              <div className="flex h-8 items-center gap-1 rounded-md border bg-background px-1">
                {FONT_WEIGHTS.map((w) => (
                  <Button
                    key={w.value}
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={node.font?.weight === w.value}
                    onClick={() => setFont({ weight: w.value })}
                    className={cn(
                      "h-6 flex-1 rounded px-0 font-mono text-[10px]",
                      node.font?.weight === w.value &&
                        "bg-primary/15 text-primary",
                    )}
                  >
                    {w.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Выравнивание */}
      <section aria-label="Выравнивание">
        <SectionTitle icon={Shapes} title="Выравнивание" />
        <div className="flex items-center gap-1 px-3">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onAlign("left")}
            aria-label="Прижать влево"
          >
            <AlignLeft className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onAlign("center")}
            aria-label="По центру"
          >
            <AlignCenter className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onAlign("right")}
            aria-label="Прижать вправо"
          >
            <AlignRight className="size-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            disabled
            title="Мультивыбор — в разработке"
            aria-label="Распределить по горизонтали (в разработке)"
          >
            <AlignHorizontalSpaceAround className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <Separator className="mt-3" />
      </section>
    </div>
  );
}
