"use client";

/**
 * Отрисовка фреймов режима «Макет» (Figma-lite): страница-фрейм с
 absolutely-спозиционированными элементами-набросками лендинга.
 * Инспекторские правки (x/y/w/h/fill/radius) живут в состоянии layout-tab.
 */

import type { LucideIcon } from "lucide-react";
import {
  Columns3,
  Frame,
  Minus,
  MousePointerClick,
  RectangleHorizontal,
  RectangleVertical,
  Sparkles,
  Square,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { LayoutFrame, LayoutNode, NodeKind } from "./layout-data";

export const NODE_ICONS: Record<NodeKind, LucideIcon> = {
  header: RectangleHorizontal,
  hero: Sparkles,
  cards: Columns3,
  footer: RectangleHorizontal,
  button: RectangleVertical,
  card: Square,
  input: Minus,
  "m-hero": Sparkles,
  "m-list": Columns3,
  "m-tabbar": RectangleHorizontal,
};

const FRAME_LABELS: Record<string, string> = {
  desktop: "Десктоп",
  mobile: "Мобайл",
};

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #059669, #064e3b)",
  "linear-gradient(135deg, #0d9488, #134e4a)",
  "linear-gradient(135deg, #b45309, #78350f)",
];

/** Плашка-строка (скелетон текста). */
function Bar({ className }: { className?: string }) {
  return (
    <span
      className={cn("block rounded-full bg-stone-600/90", className)}
      aria-hidden="true"
    />
  );
}

/** Содержимое элемента макета по типу наброска. */
function NodeContent({
  node,
  scale,
}: {
  node: LayoutNode;
  scale: number;
}) {
  switch (node.kind) {
    case "header":
      return (
        <div className="flex h-full items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <span className="size-3.5 shrink-0 rounded-md bg-primary sm:size-4" aria-hidden="true" />
          <Bar className="h-2 w-14" />
          <span className="ml-auto flex items-center gap-2">
            <Bar className="hidden h-2 w-10 sm:block" />
            <Bar className="hidden h-2 w-10 sm:block" />
            <Bar className="h-2 w-10" />
          </span>
          <span className="h-5 w-12 rounded-full bg-primary/90" aria-hidden="true" />
        </div>
      );
    case "hero":
      return (
        <div className="flex h-full flex-col items-start justify-center gap-2 px-5 sm:gap-3 sm:px-8">
          <span
            className="text-stone-100"
            style={{
              fontFamily: node.font?.family,
              fontSize: (node.font?.size ?? 48) * scale,
              fontWeight: node.font?.weight ?? 600,
              lineHeight: 1.1,
            }}
          >
            Студия в кармане
          </span>
          <Bar className="h-2.5 w-3/5" />
          <Bar className="h-2.5 w-2/5" />
          <span className="mt-1 flex items-center gap-2">
            <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-medium text-primary-foreground">
              Начать бесплатно
            </span>
            <span className="rounded-full border border-stone-600 px-3 py-1 text-[10px] text-stone-400">
              Как это работает
            </span>
          </span>
        </div>
      );
    case "cards":
      return (
        <div className="grid h-full grid-cols-3 gap-2 p-1 sm:gap-3 sm:p-2">
          {CARD_GRADIENTS.map((bg, i) => (
            <span
              key={i}
              className="flex flex-col gap-1.5 rounded-md border border-stone-700/60 p-1.5 sm:rounded-lg sm:p-2.5"
              style={{ background: "rgba(26,25,23,0.85)" }}
            >
              <span
                className="h-10 rounded-md sm:h-14"
                style={{ background: bg }}
                aria-hidden="true"
              />
              <Bar className="h-1.5 w-4/5" />
              <Bar className="h-1.5 w-3/5" />
            </span>
          ))}
        </div>
      );
    case "footer":
      return (
        <div className="flex h-full items-center gap-3 px-4">
          <span className="size-3.5 shrink-0 rounded-md bg-primary" aria-hidden="true" />
          <Bar className="h-2 w-20" />
          <Bar className="hidden h-2 w-10 sm:block" />
          <span className="ml-auto flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-2 rounded-full bg-stone-600" aria-hidden="true" />
            ))}
          </span>
        </div>
      );
    case "button":
      return (
        <span className="flex h-full items-center justify-center text-[10px] font-medium text-white/90">
          Кнопка
        </span>
      );
    case "card":
      return (
        <span className="flex h-full flex-col gap-2 rounded-lg border border-stone-700/60 p-3">
          <span
            className="flex-1 rounded-md"
            style={{ background: CARD_GRADIENTS[0] }}
            aria-hidden="true"
          />
          <Bar className="h-1.5 w-4/5" />
          <Bar className="h-1.5 w-3/5" />
        </span>
      );
    case "input":
      return (
        <div className="flex h-full items-center gap-2 px-3">
          <span className="size-3 shrink-0 rounded-full border border-stone-500" aria-hidden="true" />
          <Bar className="h-1.5 w-2/3" />
          <span className="ml-auto size-2 rounded-sm bg-stone-500" aria-hidden="true" />
        </div>
      );
    case "m-hero":
      return (
        <div className="flex h-full flex-col items-start justify-center gap-2 px-5">
          <span
            className="text-stone-100"
            style={{
              fontFamily: node.font?.family,
              fontSize: (node.font?.size ?? 28) * scale,
              fontWeight: node.font?.weight ?? 600,
              lineHeight: 1.15,
            }}
          >
            Пишите где угодно
          </span>
          <Bar className="h-2 w-4/5" />
          <Bar className="h-2 w-3/5" />
          <span className="mt-1 rounded-full bg-primary px-3 py-1 text-[9px] font-medium text-primary-foreground">
            Первый выпуск — даром
          </span>
        </div>
      );
    case "m-list":
      return (
        <ul className="flex h-full flex-col justify-center gap-2 px-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span
                className="size-6 shrink-0 rounded-full"
                style={{ background: CARD_GRADIENTS[i % 3] }}
                aria-hidden="true"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <Bar className="h-1.5 w-2/3" />
                <Bar className="h-1.5 w-1/2" />
              </span>
              <span className="size-2 shrink-0 rounded-full bg-stone-600" aria-hidden="true" />
            </li>
          ))}
        </ul>
      );
    case "m-tabbar":
      return (
        <div className="flex h-full items-center justify-around px-4">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "size-3.5 rounded-md",
                  i === 0 ? "bg-primary" : "bg-stone-600",
                )}
                aria-hidden="true"
              />
              <Bar className="h-1 w-5" />
            </span>
          ))}
        </div>
      );
  }
}

/** Один элемент макета: кликабельный, с маркерами выделения. */
function NodeView({
  node,
  scale,
  selected,
  onSelect,
}: {
  node: LayoutNode;
  scale: number;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const s = scale;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Элемент макета: ${node.name}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSelect(node.id);
        }
      }}
      className={cn(
        "absolute cursor-pointer outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/60",
        selected && "ring-2 ring-primary",
      )}
      style={{
        left: node.x * s,
        top: node.y * s,
        width: node.w * s,
        height: node.h * s,
        background: node.fill === "transparent" ? undefined : node.fill,
        borderRadius: node.radius * s,
        boxShadow: node.shadow
          ? `0 ${Math.max(2, node.shadowBlur * s * 0.3)}px ${Math.max(6, node.shadowBlur * s)}px rgba(0,0,0,0.5)`
          : undefined,
      }}
    >
      {selected
        ? [
            "-left-1 -top-1",
            "-right-1 -top-1",
            "-bottom-1 -left-1",
            "-bottom-1 -right-1",
          ].map((pos) => (
            <span
              key={pos}
              className={cn(
                "absolute size-2 rounded-[2px] border border-background bg-primary",
                pos,
              )}
              aria-hidden="true"
            />
          ))
        : null}
      <NodeContent node={node} scale={s} />
    </div>
  );
}

/** Фрейм макета с подписью. Клик по фону снимает выделение. */
export function FrameView({
  frame,
  selectedId,
  onSelect,
}: {
  frame: LayoutFrame;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const s = frame.scale;
  const label = FRAME_LABELS[frame.id] ?? "Фрейм";
  return (
    <figure className="shrink-0" aria-label={`Фрейм ${label} ${frame.name}`}>
      <figcaption className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Frame className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="font-medium text-foreground">
          {frame.name}
        </span>
        <span aria-hidden="true">—</span>
        {label} · {frame.width} × {frame.height}
      </figcaption>
      <div
        className="relative overflow-hidden rounded-lg border shadow-xl"
        style={{
          width: frame.width * s,
          height: frame.height * s,
          background: frame.pageFill,
        }}
        onClick={() => onSelect(null)}
      >
        {frame.nodes.map((node) => (
          <NodeView
            key={node.id}
            node={node}
            scale={s}
            selected={node.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
        <MousePointerClick className="size-3 shrink-0" aria-hidden="true" />
        Клик по элементу — выделение и инспектор
      </p>
    </figure>
  );
}
