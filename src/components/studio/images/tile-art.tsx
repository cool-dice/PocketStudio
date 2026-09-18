"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DOT_PATTERN_STYLE, ratioBox, type GalleryTile } from "./gallery-data";

/**
 * Общий градиентный «артворк» плитки: уникальный градиент,
 * точечная сетка, мягкий свет и крупная иконка-подпись.
 * Дети рендерятся поверх (оверлеи, чипы статуса).
 */
export function TileArt({
  tile,
  className,
  iconClassName,
  children,
}: {
  tile: GalleryTile;
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
}) {
  const Icon = tile.icon;
  return (
    <div
      className={cn("relative overflow-hidden", ratioBox(tile.ratio), className)}
      style={{ background: tile.gradient }}
    >
      <div className="absolute inset-0" style={DOT_PATTERN_STYLE} aria-hidden="true" />
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <Icon className={cn("size-12 text-white/25", iconClassName)} />
      </div>
      {children}
    </div>
  );
}
