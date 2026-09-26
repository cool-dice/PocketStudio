"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crop,
  Droplet,
  Eraser,
  MousePointer2,
  Paintbrush,
  Square,
  Type,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import {
  emptyRaster,
  parseDesignPayload,
  designPreviewUrl,
  type DesignTool,
  type RasterDoc,
  type RasterLayer,
} from "@/lib/design-model";
import { cn } from "@/lib/utils";

const TOOLS: { id: DesignTool; label: string; icon: typeof Paintbrush }[] = [
  { id: "move", label: "Перемещение", icon: MousePointer2 },
  { id: "brush", label: "Кисть", icon: Paintbrush },
  { id: "eraser", label: "Ластик", icon: Eraser },
  { id: "select", label: "Выделение", icon: Square },
  { id: "crop", label: "Кадрирование", icon: Crop },
  { id: "text", label: "Текст", icon: Type },
  { id: "shape", label: "Фигуры", icon: Square },
  { id: "eyedropper", label: "Пипетка", icon: Droplet },
];

export function RasterEditor({
  workspaceId,
  imageUrl,
}: {
  workspaceId: string;
  imageUrl?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<RasterDoc>(emptyRaster());
  const [tool, setTool] = useState<DesignTool>("brush");
  const [color, setColor] = useState("#10b981");
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<string[]>([]);
  const drawing = useRef(false);
  const cropStart = useRef<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getDesign(workspaceId, "raster");
      const payload = parseDesignPayload(
        JSON.stringify(res.design.payload),
        "raster",
      );
      if (payload.kind === "raster") {
        setDoc(payload);
        if ((payload.pendingFilters ?? []).length > 0) {
          window.setTimeout(() => {
            for (const f of payload.pendingFilters ?? []) applyFilter(f);
            setDoc((prev) => ({ ...prev, pendingFilters: [] }));
          }, 50);
        }
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось открыть холст");
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const layer of doc.layers) {
      if (!layer.visible) continue;
      ctx.globalAlpha = layer.opacity;
      if (layer.dataUrl) {
        const img = new Image();
        img.src = layer.dataUrl;
        img.onload = () => ctx.drawImage(img, 0, 0);
      }
    }
    ctx.globalAlpha = 1;
    if (imageUrl && doc.layers.every((l) => !l.dataUrl)) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  }, [doc, imageUrl]);

  function snapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory((h) => [...h.slice(-19), canvas.toDataURL("image/png")]);
  }

  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !drawing.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    if (tool === "brush" || tool === "eraser") {
      ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, tool === "eraser" ? 14 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    } else if (tool === "shape") {
      ctx.strokeStyle = color;
      ctx.strokeRect(x - 20, y - 14, 40, 28);
    } else if (tool === "text") {
      ctx.fillStyle = color;
      ctx.font = "20px Inter, sans-serif";
      ctx.fillText("Текст", x, y);
    } else if (tool === "crop") {
      if (!cropStart.current) cropStart.current = { x, y };
    } else if (tool === "select") {
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x - 24, y - 24, 48, 48);
      ctx.setLineDash([]);
    } else if (tool === "eyedropper") {
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      setColor(
        `#${[pixel[0], pixel[1], pixel[2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`,
      );
    }
  }

  async function save() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const layers: RasterLayer[] = doc.layers.map((l, i) =>
      i === 0 ? { ...l, dataUrl } : l,
    );
    const next = { ...doc, layers };
    setDoc(next);
    try {
      await api.saveDesign(workspaceId, {
        mode: "raster",
        payload: next,
        previewUrl: designPreviewUrl(dataUrl),
      });
      toast.success("Холст сохранён");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить");
    }
  }

  function undo() {
    const last = history.at(-1);
    if (!last) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const img = new Image();
    img.src = last;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    setHistory((h) => h.slice(0, -1));
  }

  function applyFilter(kind: "bright" | "contrast" | "sat" | "bw") {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    snapshot();
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      if (kind === "bright") {
        r = Math.min(255, r + 18); g = Math.min(255, g + 18); b = Math.min(255, b + 18);
      } else if (kind === "contrast") {
        const f = 1.15;
        r = Math.min(255, Math.max(0, (r - 128) * f + 128));
        g = Math.min(255, Math.max(0, (g - 128) * f + 128));
        b = Math.min(255, Math.max(0, (b - 128) * f + 128));
      } else if (kind === "sat") {
        const avg = (r + g + b) / 3;
        r = r + (r - avg) * 0.35; g = g + (g - avg) * 0.35; b = b + (b - avg) * 0.35;
      } else {
        const y = 0.3 * r + 0.59 * g + 0.11 * b;
        r = g = b = y;
      }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    ctx.putImageData(image, 0, 0);
  }

  function addLayer() {
    setDoc((prev) => ({
      ...prev,
      layers: [
        ...prev.layers,
        {
          id: `layer-${prev.layers.length + 1}`,
          name: `Слой ${prev.layers.length + 1}`,
          visible: true,
          opacity: 1,
          dataUrl: "",
        },
      ],
    }));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tool === t.id ? "default" : "outline"}
            onClick={() => setTool(t.id)}
            aria-pressed={tool === t.id}
            title={t.label}
          >
            <t.icon className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{t.label}</span>
          </Button>
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Цвет"
          className="h-8 w-10 cursor-pointer rounded border bg-background"
        />
        <Button size="sm" variant="outline" onClick={undo}>
          <Undo2 className="size-3.5" /> Отмена
        </Button>
        <Button size="sm" onClick={() => void save()}>
          Сохранить
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="vf-scroll min-w-0 flex-1 overflow-auto rounded-xl border bg-muted/30 p-2">
          <canvas
            ref={canvasRef}
            width={doc.width}
            height={doc.height}
            style={{ width: doc.width * zoom, height: doc.height * zoom }}
            className="max-w-none cursor-crosshair bg-white shadow-sm"
            onPointerDown={(e) => {
              snapshot();
              drawing.current = true;
              paint(e);
            }}
            onPointerMove={paint}
            onPointerUp={(e) => {
              if (tool === "crop" && cropStart.current && canvasRef.current) {
                const canvas = canvasRef.current;
                const rect = canvas.getBoundingClientRect();
                const x2 =
                  ((e.clientX - rect.left) / rect.width) * canvas.width;
                const y2 =
                  ((e.clientY - rect.top) / rect.height) * canvas.height;
                const x1 = cropStart.current.x;
                const y1 = cropStart.current.y;
                const sx = Math.max(0, Math.min(x1, x2));
                const sy = Math.max(0, Math.min(y1, y2));
                const sw = Math.max(8, Math.abs(x2 - x1));
                const sh = Math.max(8, Math.abs(y2 - y1));
                const ctx = canvas.getContext("2d");
                if (ctx) {
                  const cut = ctx.getImageData(sx, sy, sw, sh);
                  canvas.width = Math.round(sw);
                  canvas.height = Math.round(sh);
                  ctx.putImageData(cut, 0, 0);
                  setDoc((p) => ({
                    ...p,
                    width: canvas.width,
                    height: canvas.height,
                  }));
                }
                cropStart.current = null;
              }
              drawing.current = false;
            }}
            onPointerLeave={() => {
              drawing.current = false;
            }}
          />
        </div>
        <aside className="w-44 shrink-0 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Слои</p>
          <ul className="space-y-1">
            {doc.layers.map((layer) => (
              <li
                key={layer.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs",
                  doc.activeLayerId === layer.id && "border-primary/50 bg-primary/5",
                )}
              >
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() =>
                    setDoc((p) => ({
                      ...p,
                      layers: p.layers.map((l) =>
                        l.id === layer.id ? { ...l, visible: !l.visible } : l,
                      ),
                    }))
                  }
                  aria-label={`Видимость ${layer.name}`}
                />
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => setDoc((p) => ({ ...p, activeLayerId: layer.id }))}
                >
                  {layer.name}
                </button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" className="w-full" onClick={addLayer}>
            Слой
          </Button>
          <p className="text-xs font-medium text-muted-foreground">Фильтры</p>
          <div className="grid grid-cols-2 gap-1">
            <Button size="sm" variant="outline" onClick={() => applyFilter("bright")}>Яркость</Button>
            <Button size="sm" variant="outline" onClick={() => applyFilter("contrast")}>Контраст</Button>
            <Button size="sm" variant="outline" onClick={() => applyFilter("sat")}>Насыщ.</Button>
            <Button size="sm" variant="outline" onClick={() => applyFilter("bw")}>Ч/б</Button>
          </div>
          <label className="block text-xs text-muted-foreground">
            Зум {Math.round(zoom * 100)}%
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
        </aside>
      </div>
    </div>
  );
}
