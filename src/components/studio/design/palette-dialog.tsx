"use client";

/**
 * PaletteDialog (Фаза A) — диалог просмотра кадра мудборда:
 * крупная картинка (реальный url или градиентная заглушка TileArt),
 * промпт, метаданные и быстрые действия («в мудборд/убрать»,
 * оригинал). Часть дизайн-модуля, вызывается из moodboard-tab.
 */

import { Download, Pin, PinOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GalleryTile } from "../images/gallery-data";
import { TileArt } from "../images/tile-art";
import { formatBoardDate, isBoardTile } from "./palette-data";

export function PaletteDialog({
  tile,
  open,
  onOpenChange,
  onToggleBoard,
}: {
  tile: GalleryTile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggleBoard: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {tile ? (
          <>
            <DialogHeader className="pr-10">
              <DialogTitle className="text-base leading-snug">
                {tile.title}
              </DialogTitle>
              <DialogDescription>
                {tile.kind === "portrait" ? "Портрет" : "Изображение"} ·{" "}
                {tile.sizeLabel} · {formatBoardDate(tile.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <div className="vf-scroll max-h-[70vh] overflow-y-auto">
              {tile.url ? (
                <img
                  src={tile.url}
                  alt={tile.title}
                  className="max-h-[55vh] w-full rounded-lg border bg-muted/30 object-contain"
                />
              ) : (
                <TileArt
                  tile={tile}
                  className="w-full rounded-lg border"
                  iconClassName="size-16"
                />
              )}
              {tile.prompt && tile.prompt !== tile.title ? (
                <div className="mt-3">
                  <h3 className="text-sm font-medium">Промпт</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {tile.prompt}
                  </p>
                </div>
              ) : null}
              <dl className="mt-2">
                <MetaRow
                  label="Тип"
                  value={tile.kind === "portrait" ? "Портрет" : "Изображение"}
                />
                <MetaRow label="Размер" value={tile.sizeLabel} />
                <MetaRow label="Мудборд" value={isBoardTile(tile) ? "да" : "нет"} />
                <MetaRow label="Создано" value={formatBoardDate(tile.createdAt)} />
                <MetaRow
                  label="Файл"
                  value={tile.url ? "сгенерирован" : "нет (концепт)"}
                />
              </dl>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                aria-pressed={isBoardTile(tile)}
                onClick={() => onToggleBoard(tile.id)}
                className={cn(
                  isBoardTile(tile) &&
                    "border-emerald-600/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400",
                )}
              >
                {isBoardTile(tile) ? (
                  <>
                    <PinOff className="size-4" aria-hidden="true" />
                    Убрать из мудборда
                  </>
                ) : (
                  <>
                    <Pin className="size-4" aria-hidden="true" />
                    В мудборд
                  </>
                )}
              </Button>
              {tile.url ? (
                <Button variant="outline" asChild>
                  <a href={tile.url} download>
                    <Download className="size-4" aria-hidden="true" />
                    Открыть оригинал
                  </a>
                </Button>
              ) : null}
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
