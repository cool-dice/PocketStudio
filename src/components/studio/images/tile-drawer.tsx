"use client";

/**
 * TileDrawer (A2-c) — боковой просмотр работы на живых данных:
 * крупная картинка (реальный url) или градиентная заглушка, промпт,
 * описание и метаданные, избранное, удаление (двухшаговое
 * подтверждение), скачивание файла и повторная генерация вариации.
 */

import { useState } from "react";
import { Download, Heart, PenTool, Trash2, TriangleAlert, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAppUi } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatTileDate, type GalleryTile } from "./gallery-data";
import { TileArt } from "./tile-art";

export function TileDrawer({
  tile,
  open,
  onOpenChange,
  onVariations,
  onToggleFavorite,
  onDelete,
}: {
  tile: GalleryTile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVariations: (tile: GalleryTile) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  // Двухшаговое удаление: id плитки с подтверждением (сбрасывается
  // автоматически при смене плитки, т.к. сравнивается с текущей).
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const confirmDelete = tile !== null && confirmedId === tile.id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
        aria-describedby="tile-drawer-meta"
      >
        {tile ? (
          <>
            <SheetHeader className="border-b pr-10">
              <SheetTitle className="text-base leading-snug">{tile.title}</SheetTitle>
              <SheetDescription id="tile-drawer-meta">
                {tile.kind === "portrait" ? "Портрет" : "Изображение"} ·{" "}
                {tile.sizeLabel} · {formatTileDate(tile.createdAt)}
              </SheetDescription>
            </SheetHeader>
            <div className="vf-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <TileArt
                tile={tile}
                className="w-full rounded-xl border shadow-sm"
                iconClassName="size-20"
              />

              {tile.url ? (
                <a
                  href={tile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  Открыть оригинал в новой вкладке
                </a>
              ) : null}

              {tile.prompt && tile.prompt !== tile.title ? (
                <div>
                  <h3 className="text-sm font-medium">Промпт</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {tile.prompt}
                  </p>
                </div>
              ) : null}

              {tile.description ? (
                <div>
                  <h3 className="text-sm font-medium">Описание</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {tile.description}
                  </p>
                </div>
              ) : null}

              <dl>
                <MetaRow label="Тип" value={tile.kind === "portrait" ? "Портрет" : "Изображение"} />
                <MetaRow label="Размер" value={tile.sizeLabel} />
                {tile.stage ? <MetaRow label="Стадия" value={tile.stage} /> : null}
                <MetaRow label="Создано" value={formatTileDate(tile.createdAt)} />
                <MetaRow label="Файл" value={tile.url ? "сгенерирован" : "нет (концепт)"} />
              </dl>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    useAppUi.getState().openDesignEditor({ imageUrl: tile.url });
                  }}
                >
                  <PenTool className="size-4" aria-hidden="true" />
                  Редактировать
                </Button>
                {tile.url ? (
                  <Button variant="outline" asChild>
                    <a href={tile.url} download>
                      <Download className="size-4" aria-hidden="true" />
                      Скачать
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled
                    title="У этой работы пока нет файла"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    Скачать
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onVariations(tile);
                  }}
                >
                  <Wand2 className="size-4" aria-hidden="true" />
                  Вариации
                </Button>
                <Button
                  variant="outline"
                  aria-pressed={tile.favorite}
                  onClick={() => onToggleFavorite(tile.id)}
                  className={cn(
                    tile.favorite &&
                      "border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 hover:text-amber-700 dark:text-amber-400",
                  )}
                >
                  <Heart
                    className={cn("size-4", tile.favorite && "fill-current")}
                    aria-hidden="true"
                  />
                  {tile.favorite ? "В избранном" : "В избранное"}
                </Button>
              </div>

              {confirmDelete ? (
                <div
                  role="alertdialog"
                  aria-label="Подтверждение удаления"
                  className="rounded-xl border border-destructive/40 bg-destructive/5 p-3"
                >
                  <p className="flex items-start gap-2 text-sm">
                    <TriangleAlert
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                    Удалить «{tile.title}» безвозвратно?
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        setConfirmedId(null);
                        onOpenChange(false);
                        onDelete(tile.id);
                      }}
                    >
                      Удалить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => setConfirmedId(null)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmedId(tile.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Удалить
                </Button>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
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
