"use client";

/**
 * Режим «Растр» — упрощённый Photoshop.
 * Холст собран из абсолютных div-слоёв: скрытие, прозрачность и порядок
 * слоёв реально влияют на картинку; фильтры применяются как CSS-фильтры.
 */

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Download,
  Eye,
  EyeOff,
  FileImage,
  Maximize,
  Redo2,
  SlidersHorizontal,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  ART_H,
  ART_W,
  DEFAULT_BRUSH,
  DEFAULT_FILTERS,
  HISTORY_SEED,
  LUT_PRESETS,
  RASTER_LAYERS,
  RASTER_TOOLS,
  type BrushSettings,
  type DesignFile,
  type HistoryItem,
  type LutPreset,
  type RasterFilters,
  type RasterLayerDef,
} from "./design-data";
import {
  LayersPanel,
  ToolPanel,
  WipMiniBadge,
} from "./raster-panels";
import { FiltersPanel, HistoryPanel } from "./raster-history";

const ZOOM_STEPS = [25, 50, 75, 100, 150, 200] as const;
const FIT_ZOOM = 75;

/** Курсор холста под активный инструмент. */
const TOOL_CURSOR: Record<string, string> = {
  move: "move",
  brush: "crosshair",
  eraser: "crosshair",
  select: "crosshair",
  crop: "crosshair",
  text: "text",
  shapes: "crosshair",
  pipette: "crosshair",
};

/** Снимок растрового состояния для отмен: клик по истории = путешествие. */
interface RasterSnapshot {
  layers: RasterLayerDef[];
  filters: RasterFilters;
  lutId: string | null;
}

/** Запись истории + состояние «после операции». */
interface HistoryEntry extends HistoryItem {
  snapshot: RasterSnapshot;
}

/** Стартовое состояние: то, к которому откатываются записи-«предыстория». */
const INITIAL_SNAPSHOT: RasterSnapshot = {
  layers: RASTER_LAYERS,
  filters: DEFAULT_FILTERS,
  lutId: null,
};

export function RasterTab({ file }: { file: DesignFile }) {
  const [toolId, setToolId] = useState("brush");
  const [layers, setLayers] = useState<RasterLayerDef[]>(RASTER_LAYERS);
  const [activeLayerId, setActiveLayerId] = useState("mountains");
  const [filters, setFilters] = useState<RasterFilters>(DEFAULT_FILTERS);
  const [lutId, setLutId] = useState<string | null>(null);
  const [brush, setBrush] = useState<BrushSettings>(DEFAULT_BRUSH);
  const [zoom, setZoom] = useState(FIT_ZOOM);
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    HISTORY_SEED.map((item) => ({ ...item, snapshot: INITIAL_SNAPSHOT })),
  );
  const [histIndex, setHistIndex] = useState(HISTORY_SEED.length - 1);

  const tool = RASTER_TOOLS.find((t) => t.id === toolId) ?? RASTER_TOOLS[1];
  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? null;
  const lut: LutPreset | null = LUT_PRESETS.find((l) => l.id === lutId) ?? null;

  /* ── История: снимок + обрезка «будущего» ── */
  const pushHistory = (
    label: string,
    icon: LucideIcon,
    patch?: Partial<RasterSnapshot>,
  ) => {
    const snapshot: RasterSnapshot = { layers, filters, lutId, ...patch };
    setHistory((prev) => [
      ...prev.slice(0, histIndex + 1),
      {
        id: `h-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        label,
        icon,
        snapshot,
      },
    ]);
    setHistIndex(histIndex + 1);
  };

  /** Откат/возврат: восстановить состояние записи истории. */
  const timeTravel = (index: number) => {
    const entry = history[index];
    if (!entry) return;
    setHistIndex(index);
    setLayers(entry.snapshot.layers);
    setFilters(entry.snapshot.filters);
    setLutId(entry.snapshot.lutId);
  };

  const undo = () => timeTravel(Math.max(0, histIndex - 1));
  const redo = () => timeTravel(Math.min(history.length - 1, histIndex + 1));

  /* ── Слои ── */
  const toggleVisible = (id: string) => {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    const next = layers.map((l) =>
      l.id === id ? { ...l, visible: !l.visible } : l,
    );
    setLayers(next);
    pushHistory(
      layer.visible
        ? `Слой «${layer.name}» скрыт`
        : `Слой «${layer.name}» показан`,
      layer.visible ? EyeOff : Eye,
      { layers: next },
    );
  };

  const toggleLock = (id: string) =>
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
    );

  const setLayerOpacity = (id: string, value: number) =>
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, opacity: value } : l)),
    );

  const moveLayer = (id: string, dir: -1 | 1) =>
    setLayers((prev) => {
      const i = prev.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /* ── Зум ── */
  const stepZoom = (dir: -1 | 1) => {
    const idx = ZOOM_STEPS.findIndex((z) => z === zoom);
    const base = idx === -1 ? 2 : idx;
    const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, base + dir));
    setZoom(ZOOM_STEPS[next]);
  };

  const filterCss = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)${
    filters.grayscale ? " grayscale(100%)" : ""
  }`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      {/* ── Левая вертикальная панель инструментов ── */}
      <div
        role="toolbar"
        aria-label="Инструменты растра"
        className="vf-scroll-x flex shrink-0 flex-row gap-1 overflow-x-auto border-b bg-muted/40 p-1.5 md:w-[52px] md:flex-col md:overflow-visible md:border-r md:border-b-0 md:p-2"
      >
        {RASTER_TOOLS.map((t) => {
          const active = t.id === toolId;
          return (
            <Tooltip key={t.id}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-pressed={active}
                  onClick={() => setToolId(t.id)}
                  className={cn(
                    "size-9 shrink-0",
                    active && "bg-primary/15 text-primary hover:bg-primary/20",
                  )}
                >
                  <t.icon className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="md:hidden">
                {t.name} · {t.hotkey}
              </TooltipContent>
              <TooltipContent side="right" className="hidden md:block">
                {t.name} · {t.hotkey}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* ── Центр: мини-бар + холст ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Мини-бар файла */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card/50 px-3 py-2">
          <FileImage
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate text-sm font-medium">
            {file.name}
          </span>
          <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
            2048 × 1365
          </span>
          <span className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={undo}
              disabled={histIndex <= 0}
              aria-label="Отменить"
            >
              <Undo2 className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={redo}
              disabled={histIndex >= history.length - 1}
              aria-label="Повторить"
            >
              <Redo2 className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="sm" className="ml-1 gap-2">
              <Download className="size-4" aria-hidden="true" />
              Экспорт PNG
            </Button>
            <WipMiniBadge />
          </span>
        </div>

        {/* Холст */}
        <div
          className="relative h-[340px] shrink-0 overflow-auto bg-muted/30 p-4 sm:h-[420px] md:h-auto md:min-h-0 md:flex-1 md:p-8"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(120,113,108,0.25) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <div className="flex min-h-full items-center justify-center">
            <div
              style={{ width: (ART_W * zoom) / 100, height: (ART_H * zoom) / 100 }}
            >
              <div
                className="relative shadow-2xl ring-1 ring-border"
                style={{
                  width: ART_W,
                  height: ART_H,
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: "top left",
                  filter: filterCss,
                  cursor: TOOL_CURSOR[toolId] ?? "default",
                  backgroundImage:
                    "repeating-conic-gradient(#d6d3d1 0% 25%, #f5f5f4 0% 50%)",
                  backgroundSize: "20px 20px",
                }}
                role="img"
                aria-label={`Холст ${file.name}: слоистая композиция «Зимний перевал»`}
              >
                {layers.map((layer, index) => (
                  <div
                    key={layer.id}
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: layers.length - index,
                      opacity: layer.opacity / 100,
                      visibility: layer.visible ? "visible" : "hidden",
                      ...layer.style,
                    }}
                  >
                    {layer.text ? (
                      <span style={layer.textStyle}>{layer.text}</span>
                    ) : null}
                  </div>
                ))}
                {lut ? (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      zIndex: 99,
                      background: lut.overlayCss,
                      mixBlendMode: lut.blend,
                      opacity: lut.overlayOpacity,
                    }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </div>
          </div>

          {/* Контекстный чип: инструмент + слой */}
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border bg-background/85 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
            <tool.icon className="size-3.5 text-primary" aria-hidden="true" />
            {tool.name}
            {activeLayer ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="max-w-40 truncate">
                  слой «{activeLayer.name}»
                </span>
              </>
            ) : null}
          </div>

          {/* Зум-контролы */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => stepZoom(-1)}
              aria-label="Уменьшить масштаб"
            >
              <ZoomOut className="size-3.5" aria-hidden="true" />
            </Button>
            <span
              className="min-w-10 text-center font-mono text-[11px] tabular-nums"
              aria-live="polite"
            >
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => stepZoom(1)}
              aria-label="Увеличить масштаб"
            >
              <ZoomIn className="size-3.5" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 font-mono text-[11px]"
              onClick={() => setZoom(100)}
            >
              100%
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setZoom(FIT_ZOOM)}
              aria-label="Вписать в окно"
            >
              <Maximize className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Правая панель ── */}
      <aside
        aria-label="Панель растра"
        className="w-full shrink-0 border-t bg-card/50 md:w-[268px] md:border-l md:border-t-0"
      >
        <div className="vf-scroll md:h-full md:overflow-y-auto">
          <LayersPanel
            layers={layers}
            activeId={activeLayerId}
            onSelect={setActiveLayerId}
            onToggleVisible={toggleVisible}
            onToggleLock={toggleLock}
            onOpacity={setLayerOpacity}
            onMove={moveLayer}
          />
          <ToolPanel
            tool={tool}
            brush={brush}
            onBrush={(patch) => setBrush((b) => ({ ...b, ...patch }))}
          />
          <FiltersPanel
            filters={filters}
            onFilters={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onCommit={(label, patch) => {
              const snap: Partial<RasterSnapshot> = {};
              if (patch?.filters) snap.filters = { ...filters, ...patch.filters };
              if (patch?.lutId !== undefined) snap.lutId = patch.lutId;
              pushHistory(label, SlidersHorizontal, snap);
            }}
            activeLut={lutId}
            onLut={setLutId}
          />
          <HistoryPanel
            history={history}
            activeIndex={histIndex}
            onSelect={timeTravel}
          />
        </div>
      </aside>
    </div>
  );
}
