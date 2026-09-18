"use client";

import { Copy, Download, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WipBanner } from "@/components/studio/shared/module-header";
import { ratioSize, type GalleryTile } from "./gallery-data";
import { TileArt } from "./tile-art";

/** Боковой просмотр выбранной работы: превью, метаданные и действия. */
export function TileDrawer({
  tile,
  open,
  onOpenChange,
  onVariations,
  onDelete,
}: {
  tile: GalleryTile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVariations: (tile: GalleryTile) => void;
  onDelete: (id: string) => void;
}) {
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
              <SheetTitle className="text-base leading-snug">{tile.prompt}</SheetTitle>
              <SheetDescription id="tile-drawer-meta">
                {tile.style} · {ratioSize(tile.ratio)} · seed {tile.seed}
              </SheetDescription>
            </SheetHeader>
            <div className="vf-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <TileArt
                tile={tile}
                className="w-full rounded-xl border shadow-sm"
                iconClassName="size-20"
              />

              <div>
                <h3 className="text-sm font-medium">Промпт</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tile.prompt}</p>
              </div>

              <dl>
                <MetaRow label="Стиль" value={tile.style} />
                <MetaRow label="Размер" value={ratioSize(tile.ratio)} />
                <MetaRow label="Seed" value={String(tile.seed)} />
                <MetaRow label="Создано" value={tile.createdAt} />
              </dl>

              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline">
                  <Download className="size-4" aria-hidden="true" />
                  Скачать
                </Button>
                <Button variant="outline" onClick={() => onVariations(tile)}>
                  <Copy className="size-4" aria-hidden="true" />
                  Вариации
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onDelete(tile.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  Удалить
                </Button>
              </div>

              <WipBanner
                title="Визуальный макет"
                description="Реальная генерация подключается на следующем этапе."
              />
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
