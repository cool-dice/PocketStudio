"use client";

/**
 * Дизайн — единый редактор: растр (Photoshop-lite), макеты (Figma-lite)
 * и превью/дизайнер интерфейса (курсор-стиль, IDE).
 * Визуальный макет: режимы переключаются локально, без бэкенда.
 */

import { useState } from "react";
import {
  Frame,
  Image as ImageIcon,
  Monitor,
  PenTool,
  Save,
} from "lucide-react";

import {
  ModuleHeader,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  KIND_META,
  RECENT_FILES,
  type DesignFile,
  type DesignMode,
} from "./design-data";
import { FilesCatalog } from "./files-catalog";
import { LayoutTab } from "./layout-tab";
import { PreviewTab } from "./preview-tab";
import { RasterTab } from "./raster-tab";

export function DesignScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [mode, setMode] = useState<DesignMode>("raster");
  const [fileId, setFileId] = useState(RECENT_FILES[0].id);

  const file = RECENT_FILES.find((f) => f.id === fileId) ?? RECENT_FILES[0];

  /** Открытие файла из каталога: режим следует за типом файла. */
  const openFile = (next: DesignFile) => {
    setFileId(next.id);
    setMode(next.mode);
  };

  const KindIcon = KIND_META[file.kind].icon;

  return (
    <section
      aria-label="Дизайн"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={PenTool}
        title="Дизайн"
        description="Единый редактор: растр, макеты и правки интерфейса"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button variant="outline" size="sm">
          <Save className="size-4" aria-hidden="true" />
          Сохранить
        </Button>
      </ModuleHeader>

      {/* Контекст-бар: файл + режимы редактора */}
      <div className="shrink-0 border-b bg-muted/30 px-3 py-2 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilesCatalog currentId={fileId} onSelect={openFile} />
          <span className="flex min-w-0 items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5">
            <KindIcon
              className="size-3.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="min-w-0 truncate text-xs font-medium">
              {file.name}
            </span>
            <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline">
              · {file.updated}
            </span>
          </span>

          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as DesignMode)}
            className="ml-auto"
          >
            <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
              <TabsTrigger value="raster">
                <ImageIcon className="size-3.5" aria-hidden="true" />
                Растр
              </TabsTrigger>
              <TabsTrigger value="layout">
                <Frame className="size-3.5" aria-hidden="true" />
                Макет
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Monitor className="size-3.5" aria-hidden="true" />
                Превью (IDE)
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Активный режим */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {mode === "raster" ? (
          <RasterTab file={file} />
        ) : mode === "layout" ? (
          <LayoutTab file={file} />
        ) : (
          <PreviewTab file={file} />
        )}
      </main>
    </section>
  );
}
