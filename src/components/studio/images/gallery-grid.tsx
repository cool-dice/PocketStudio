"use client";

/**
 * GalleryGrid (A2-c) — сетка галереи на живых артефактах:
 * реальные картинки (<img> с url) и градиентные заглушки, оверлей
 * действий (открыть / вариации / скачать / избранное / удалить),
 * плитка-заглушка «Студия рисует…» и скелетоны загрузки.
 */

import type { ReactNode } from "react";
import { Download, Heart, Images, Maximize2, Sparkles, Trash2, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type GalleryTile } from "./gallery-data";
import { TileArt } from "./tile-art";

export function GalleryGrid({
  tiles,
  loading,
  emptyLabel,
  onOpen,
  onVariations,
  onToggleFavorite,
  onDelete,
}: {
  tiles: GalleryTile[];
  loading?: boolean;
  emptyLabel?: string;
  onOpen: (id: string) => void;
  onVariations: (tile: GalleryTile) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <div
        aria-label="Галерея загружается"
        className="vf-scroll min-h-0 flex-1 overflow-y-auto pr-1"
      >
        <div className="grid grid-cols-2 gap-3 pb-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 6 }, (_, i) => (
            <figure key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <Skeleton className="h-3 w-4/5 rounded" />
              <Skeleton className="h-2.5 w-2/5 rounded" />
            </figure>
          ))}
        </div>
      </div>
    );
  }

  if (tiles.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
        <Images className="size-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {emptyLabel ??
            "Ничего не найдено — попробуйте изменить запрос или фильтры"}
        </p>
      </div>
    );
  }

  return (
    <div
      className="vf-scroll min-h-0 flex-1 overflow-y-auto pr-1"
      aria-label="Галерея изображений"
    >
      <div className="grid grid-cols-2 gap-3 pb-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {tiles.map((tile) => (
          <GalleryTileCard
            key={tile.id}
            tile={tile}
            onOpen={onOpen}
            onVariations={onVariations}
            onToggleFavorite={onToggleFavorite}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}

function GalleryTileCard({
  tile,
  onOpen,
  onVariations,
  onToggleFavorite,
  onDelete,
}: {
  tile: GalleryTile;
  onOpen: (id: string) => void;
  onVariations: (tile: GalleryTile) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <figure className="group/tile">
      <TileArt
        tile={tile}
        className="cursor-zoom-in rounded-xl border shadow-sm transition-shadow duration-200 group-hover/tile:shadow-md"
      >
        {tile.status === "generating" ? (
          <div className="absolute inset-0 flex animate-pulse flex-col items-center justify-center gap-2 bg-stone-200/95 dark:bg-stone-900/95">
            <Sparkles className="size-6 text-primary" aria-hidden="true" />
            <span className="px-2 text-center text-xs font-medium text-muted-foreground">
              Студия рисует…
            </span>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-1 bg-black/50 p-1 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 focus-within:opacity-100 group-hover/tile:opacity-100">
              <TileAction label="Открыть" onClick={() => onOpen(tile.id)}>
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </TileAction>
              <TileAction
                label="Сгенерировать вариацию по этому промпту"
                onClick={() => onVariations(tile)}
              >
                <Wand2 className="size-3.5" aria-hidden="true" />
              </TileAction>
              {tile.url ? (
                <a
                  href={tile.url}
                  download
                  aria-label="Скачать файл"
                  title="Скачать файл"
                  className="flex size-7 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/25 hover:text-white"
                >
                  <Download className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
              <TileAction
                label={tile.favorite ? "Убрать из избранного" : "В избранное"}
                active={tile.favorite}
                onClick={() => onToggleFavorite(tile.id)}
              >
                <Heart
                  className={cn("size-3.5", tile.favorite && "fill-current")}
                  aria-hidden="true"
                />
              </TileAction>
              <TileAction label="Удалить" danger onClick={() => onDelete(tile.id)}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </TileAction>
            </div>
            {tile.favorite ? (
              <span
                className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/45 p-1 text-white backdrop-blur-sm"
                aria-hidden="true"
              >
                <Heart className="size-3 fill-amber-400 text-amber-400" />
              </span>
            ) : null}
          </>
        )}
      </TileArt>
      <figcaption className="mt-2 space-y-1.5">
        <p className="truncate text-xs font-medium" title={tile.title}>
          {tile.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex min-w-0 max-w-[65%] items-center truncate rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            title={tile.prompt}
          >
            {tile.kind === "portrait" ? "Портрет" : "Изображение"}
            {tile.stage ? ` · ${tile.stage}` : ""}
          </span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
            {tile.sizeLabel}
          </span>
        </div>
      </figcaption>
    </figure>
  );
}

function TileAction({
  label,
  onClick,
  active,
  danger,
  children,
}: {
  label: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "size-7 rounded-lg text-white/90 hover:bg-white/25 hover:text-white",
        danger && "hover:bg-rose-500/70",
        active && "text-emerald-300 hover:text-emerald-200",
      )}
    >
      {children}
    </Button>
  );
}
