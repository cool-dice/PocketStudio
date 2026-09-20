"use client";

import { useCallback, useEffect, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import {
  emptyLayout,
  parseDesignPayload,
  type LayoutDoc,
  type LayoutFrame,
} from "@/lib/design-model";
import { cn } from "@/lib/utils";

export function LayoutEditor({ workspaceId }: { workspaceId: string }) {
  const [doc, setDoc] = useState<LayoutDoc>(emptyLayout());

  const load = useCallback(async () => {
    try {
      const res = await api.getDesign(workspaceId, "layout");
      const payload = parseDesignPayload(
        JSON.stringify(res.design.payload),
        "layout",
      );
      if (payload.kind === "layout") setDoc(payload);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось открыть макет");
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = doc.frames.find((f) => f.id === doc.selectedId) ?? null;

  function updateFrame(id: string, patch: Partial<LayoutFrame>) {
    setDoc((p) => ({
      ...p,
      frames: p.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }

  function addFrame() {
    const id = `frame-${doc.frames.length + 1}`;
    setDoc((p) => ({
      ...p,
      selectedId: id,
      frames: [
        ...p.frames,
        {
          id,
          name: `Фрейм ${p.frames.length + 1}`,
          x: 80 + p.frames.length * 16,
          y: 80 + p.frames.length * 16,
          w: 240,
          h: 120,
          fill: "#ffffff",
          radius: 8,
          shadow: false,
          fontFamily: "Inter, sans-serif",
          fontSize: 16,
          text: "Новый блок",
        },
      ],
    }));
  }

  async function save() {
    try {
      await api.saveDesign(workspaceId, { mode: "layout", payload: doc });
      toast.success("Макет сохранён");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить");
    }
  }

  function align(kind: "left" | "center" | "right") {
    if (!selected) return;
    const x =
      kind === "left" ? 16 : kind === "right" ? doc.width - selected.w - 16 : (doc.width - selected.w) / 2;
    updateFrame(selected.id, { x });
  }

  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <aside className="w-40 shrink-0 space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Дерево</p>
        <ul className="space-y-1">
          {doc.frames.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setDoc((p) => ({ ...p, selectedId: f.id }))}
                className={cn(
                  "w-full rounded-lg border px-2 py-1.5 text-left text-xs",
                  doc.selectedId === f.id && "border-primary/50 bg-primary/5",
                )}
              >
                {f.name}
              </button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="outline" className="w-full" onClick={addFrame}>
          Фрейм
        </Button>
        <Button size="sm" className="w-full" onClick={() => void save()}>
          Сохранить
        </Button>
      </aside>
      <div
        className="relative min-w-0 flex-1 overflow-auto rounded-xl border bg-muted/40"
        style={{ minHeight: 360 }}
      >
        <div
          className="relative mx-auto my-6 bg-white shadow-sm"
          style={{ width: doc.width, height: doc.height }}
        >
          {doc.frames.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDoc((p) => ({ ...p, selectedId: f.id }))}
              className={cn(
                "absolute text-left",
                doc.selectedId === f.id && "ring-2 ring-primary",
              )}
              style={{
                left: f.x,
                top: f.y,
                width: f.w,
                height: f.h,
                background: f.fill,
                borderRadius: f.radius,
                boxShadow: f.shadow ? "0 8px 24px rgba(0,0,0,.12)" : undefined,
                fontFamily: f.fontFamily,
                fontSize: f.fontSize,
                padding: 12,
              }}
            >
              {f.text}
            </button>
          ))}
        </div>
      </div>
      <aside className="w-52 shrink-0 space-y-2 text-xs">
        <p className="font-medium text-muted-foreground">Инспектор</p>
        {selected ? (
          <>
            {(["x", "y", "w", "h"] as const).map((key) => (
              <label key={key} className="block">
                {key}
                <Input
                  type="number"
                  className="mt-1 h-8"
                  value={selected[key]}
                  onChange={(e) =>
                    updateFrame(selected.id, { [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
            <label className="block">
              Fill
              <input
                type="color"
                className="mt-1 h-8 w-full"
                value={selected.fill}
                onChange={(e) => updateFrame(selected.id, { fill: e.target.value })}
              />
            </label>
            <label className="block">
              Radius
              <Input
                type="number"
                className="mt-1 h-8"
                value={selected.radius}
                onChange={(e) =>
                  updateFrame(selected.id, { radius: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.shadow}
                onChange={(e) => updateFrame(selected.id, { shadow: e.target.checked })}
              />
              Тень
            </label>
            <label className="block">
              Текст
              <Input
                className="mt-1 h-8"
                value={selected.text}
                onChange={(e) => updateFrame(selected.id, { text: e.target.value })}
              />
            </label>
            <label className="block">
              Шрифт px
              <Input
                type="number"
                className="mt-1 h-8"
                value={selected.fontSize}
                onChange={(e) =>
                  updateFrame(selected.id, { fontSize: Number(e.target.value) })
                }
              />
            </label>
            <div className="flex gap-1">
              <Button size="icon" variant="outline" className="size-8" onClick={() => align("left")}>
                <AlignLeft className="size-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="size-8" onClick={() => align("center")}>
                <AlignCenter className="size-3.5" />
              </Button>
              <Button size="icon" variant="outline" className="size-8" onClick={() => align("right")}>
                <AlignRight className="size-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Выберите фрейм</p>
        )}
      </aside>
    </div>
  );
}
