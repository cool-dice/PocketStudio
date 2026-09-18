"use client";

import type { ReactNode } from "react";
import { Copy, Download, Heart, Images, Maximize2, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ratioSize, type GalleryTile } from "./gallery-data";
import { TileArt } from "./tile-art";

/** Скроллящаяся сетка галереи + плитка с оверлеем действий. */
export function GalleryGrid({
  tiles,
  onOpen,
  onVariations,
  onToggleFavorite,
  onDelete,
}: {
  tiles: GalleryTile[];
  onOpen: (id: string) => void;
  onVariations: (tile: GalleryTile) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (tiles.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center">
        <Images className="size-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Ничего не найдено — попробуйте изменить запрос или фильтры
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
        className="rounded-xl border shadow-sm transition-shadow duration-200 group-hover/tile:shadow-md"
      >
        {tile.status === "generating" ? (
          <div className="absolute inset-0 flex animate-pulse flex-col items-center justify-center gap-2 bg-stone-200/95 dark:bg-stone-900/95">
            <Sparkles className="size-6 text-primary" aria-hidden="true" />
            <span className="text-xs font-medium text-muted-foreground">Генерация…</span>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-1 bg-black/50 p-1 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 focus-within:opacity-100 group-hover/tile:opacity-100">
              <TileAction label="Открыть" onClick={() => onOpen(tile.id)}>
                <Maximize2 className="size-3.5" aria-hidden="true" />
              </TileAction>
              <TileAction label="Вариации" onClick={() => onVariations(tile)}>
                <Copy className="size-3.5" aria-hidden="true" />
              </TileAction>
              <TileAction label="Скачать">
                <Download className="size-3.5" aria-hidden="true" />
              </TileAction>
              <TileAction
                label={tile.favorite ? "Убрать из избранного" : "В избранное"}
                active={tile.favorite}
                onClick={() => onToggleFavorite(tile.id)}
              >
                <Heart className={cn("size-3.5", tile.favorite && "fill-current")} aria-hidden="true" />
              </TileAction>
              <TileAction label="Удалить" danger onClick={() => onDelete(tile.id)}>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </TileAction>
            </div>
            {tile.status === "draft" ? (
              <span className="absolute top-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-950 shadow-sm">
                В разработке
              </span>
            ) : null}
          </>
        )}
      </TileArt>
      <figcaption className="mt-2 space-y-1.5">
        <p className="truncate text-xs font-medium" title={tile.prompt}>
          {tile.prompt}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex min-w-0 max-w-[65%] items-center truncate rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tile.style}
          </span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
            {ratioSize(tile.ratio)}
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
