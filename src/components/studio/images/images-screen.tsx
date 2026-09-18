"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, ImageUp } from "lucide-react";

import { ModuleHeader, type ModuleScreenProps } from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import { FilterBar, type GalleryFilter, type GallerySort } from "./filter-bar";
import { GalleryGrid } from "./gallery-grid";
import {
  INITIAL_TILES,
  makeGeneratingTile,
  type GalleryTile,
  type ImageRatio,
} from "./gallery-data";
import { GenerationPanel } from "./generation-panel";
import { TileDrawer } from "./tile-drawer";

/** Через сколько мс «генерация» превращается в градиентную заготовку. */
const GENERATE_MS = 2400;

/**
 * Экран «Изображения» — карманная галерея студии.
 * Чистый визуальный макет: локальный state, без запросов к API.
 */
export function ImagesScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [tiles, setTiles] = useState<GalleryTile[]>(INITIAL_TILES);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [sort, setSort] = useState<GallerySort>("new");

  // Идентификатор выбранной плитки живёт отдельно от open, чтобы контент
  // панели не исчезал во время анимации закрытия.
  const [drawerTileId, setDrawerTileId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
    };
  }, []);

  /** Ставит плитки в очередь «генерация → заготовка». */
  const scheduleReveal = (ids: string[]) => {
    ids.forEach((id, i) => {
      const timer = setTimeout(() => {
        setTiles((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: "draft" as const } : t)),
        );
      }, GENERATE_MS + i * 600);
      timers.current.push(timer);
    });
  };

  const generate = (prompt: string, style: string, ratio: ImageRatio, count: number) => {
    const created = Array.from({ length: count }, () =>
      makeGeneratingTile(prompt, style, ratio),
    );
    setTiles((prev) => [...created, ...prev]);
    scheduleReveal(created.map((t) => t.id));
  };

  const makeVariations = (tile: GalleryTile) => {
    const created = [makeGeneratingTile(tile.prompt, tile.style, tile.ratio)];
    setTiles((prev) => [...created, ...prev]);
    scheduleReveal(created.map((t) => t.id));
  };

  const toggleFavorite = (id: string) =>
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)));

  const removeTile = (id: string) => setTiles((prev) => prev.filter((t) => t.id !== id));

  const visibleTiles = useMemo(() => {
    let list = tiles;
    if (filter === "favorites") list = list.filter((t) => t.favorite);
    else if (filter !== "all") list = list.filter((t) => t.style === filter);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) => t.prompt.toLowerCase().includes(q) || t.style.toLowerCase().includes(q),
      );
    }

    const sorted = [...list];
    if (sort === "old") sorted.reverse();
    else if (sort === "popular") sorted.sort((a, b) => b.likes - a.likes);
    return sorted;
  }, [tiles, filter, query, sort]);

  const drawerTile = useMemo(
    () => tiles.find((t) => t.id === drawerTileId) ?? null,
    [tiles, drawerTileId],
  );

  const openTile = (id: string) => {
    setDrawerTileId(id);
    setDrawerOpen(true);
  };

  return (
    <section
      aria-label="Изображения"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={ImagePlus}
        title="Изображения"
        description="Иллюстрации, обложки и концепты по текстовому описанию"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button variant="outline" size="sm">
          <ImageUp className="size-4" aria-hidden="true" />
          Загрузить референс
        </Button>
      </ModuleHeader>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <GenerationPanel onGenerate={generate} />
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          sort={sort}
          onSortChange={setSort}
          count={visibleTiles.length}
        />
        <GalleryGrid
          tiles={visibleTiles}
          onOpen={openTile}
          onVariations={makeVariations}
          onToggleFavorite={toggleFavorite}
          onDelete={removeTile}
        />
      </main>

      <TileDrawer
        tile={drawerTile}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onVariations={(tile) => {
          setDrawerOpen(false);
          makeVariations(tile);
        }}
        onDelete={(id) => {
          setDrawerOpen(false);
          removeTile(id);
        }}
      />
    </section>
  );
}
