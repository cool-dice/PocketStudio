"use client";

/**
 * TileArt — превью плитки галереи на живых данных (A2-c):
 * есть url → реальная картинка (<img>, object-cover, ленивая загрузка);
 * нет файла → градиентная заглушка (CSS-градиент или tailwind-классы
 * из meta.gradient) с точечной текстурой и крупной иконкой типа.
 * Дети рендерятся поверх (оверлеи действий, статус генерации).
 */

import type { ReactNode } from "react";
import { ImagePlus, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  aspectClass,
  DOT_PATTERN_STYLE,
  FALLBACK_GRADIENT,
  type GalleryTile,
} from "./gallery-data";

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
  const gradient = tile.gradient ?? FALLBACK_GRADIENT;
  const isCssGradient = /gradient\(/.test(gradient);
  const Icon = tile.kind === "portrait" ? UserRound : ImagePlus;

  return (
    <div
      className={cn("relative overflow-hidden", aspectClass(tile.aspect), className)}
      style={isCssGradient ? { background: gradient } : undefined}
    >
      {!isCssGradient && !tile.url ? (
        <div
          aria-hidden="true"
          className={cn("absolute inset-0 bg-gradient-to-br", gradient)}
        />
      ) : null}

      {tile.url && !tile.fileMissing ? (
        <img
          src={tile.url}
          alt={tile.title}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          <div
            className="absolute inset-0"
            style={DOT_PATTERN_STYLE}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <Icon className={cn("size-12 text-white/25", iconClassName)} />
          </div>
        </>
      )}
      {children}
    </div>
  );
}
