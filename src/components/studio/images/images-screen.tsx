"use client";

/**
 * ImagesScreen (A2-c) — «Изображения» на живых данных Фазы A.
 * Вкладка воркспейса (workspaceId передаётся швом workspace-tabs):
 * галерея артефактов типа image/portrait этого воркспейса + РЕАЛЬНАЯ
 * генерация через api.aiGenerateImage (≈30–45 сек, плашка прогресса).
 * Глобальный экран (без id): выбор воркспейса чипами с counts.images.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImagePlus, Images, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ModuleHeader, type ModuleScreenProps } from "@/components/studio/shared/module-header";
import { WorkspacePickerStatus } from "@/components/studio/shared/workspace-picker-status";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import {
  IMAGE_GALLERY_EMPTY,
  IMAGE_GALLERY_EMPTY_HINT,
  IMAGE_GALLERY_FILTER_EMPTY,
  IMAGE_GALLERY_LOAD_ERROR,
  IMAGE_GALLERY_LOAD_ERROR_HINT,
  IMAGE_GEN_FAILED,
  IMAGE_GEN_FAILED_HINT,
  IMAGE_GEN_UNCONFIGURED_HINT,
  displayableImageSrc,
} from "@/lib/image-copy";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useAppUi } from "@/lib/store";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import { FilterBar, type GalleryFilter, type GallerySort } from "./filter-bar";
import { GalleryGrid } from "./gallery-grid";
import {
  pendingTile,
  presetById,
  tileFromArtifact,
  type GalleryTile,
} from "./gallery-data";
import { GenerationPanel, type GenerationRequest } from "./generation-panel";
import { SelectableChip } from "./chip";
import { TileDrawer } from "./tile-drawer";

export function ImagesScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  const { workspaces, loading: wsLoading, error: wsError, load: loadWorkspaces } =
    useWorkspaces();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const effectiveId = workspaceId ?? pickedId;

  /* Галерея живых артефактов. */
  const [tiles, setTiles] = useState<GalleryTile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  /* Каталогизация. */
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GalleryFilter>("all");
  const [sort, setSort] = useState<GallerySort>("new");

  /* Генерация (30–45 сек). */
  const [generating, setGenerating] = useState<{
    prompt: string;
    sizeLabel: string;
    aspect: GalleryTile["aspect"];
  } | null>(null);

  /* Просмотр выбранной работы. */
  const [drawerTileId, setDrawerTileId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const workspaceVersion = useAppUi((s) => s.workspaceVersion);

  /* Загрузка галереи воркспейса: image + portrait. */
  const loadGallery = useCallback(async () => {
    if (!effectiveId) {
      setTiles([]);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [images, portraits] = await Promise.all([
        api.listArtifacts(effectiveId, "image"),
        api.listArtifacts(effectiveId, "portrait"),
      ]);
      const merged = [...images, ...portraits].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
      setTiles(merged.map((a) => tileFromArtifact(a)));
    } catch (err) {
      setTiles([]);
      setLoadError(
        err instanceof ApiError ? err.message : IMAGE_GALLERY_LOAD_ERROR,
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    void loadGallery();
  }, [loadGallery, workspaceVersion]);

  /* РЕАЛЬНАЯ генерация → api.aiGenerateImage. */
  const runGenerate = useCallback(
    async ({ prompt, title, size }: GenerationRequest) => {
      if (!effectiveId) return;
      const preset = presetById(size);
      setGenerating({ prompt, sizeLabel: preset.size, aspect: preset.aspect });
      try {
        const artifact = await api.aiGenerateImage({
          projectId: effectiveId,
          prompt,
          title: title || undefined,
          size,
        });
        const src = displayableImageSrc(artifact);
        if (!src) {
          toast.error(IMAGE_GEN_FAILED, { description: IMAGE_GEN_FAILED_HINT });
          return;
        }
        setTiles((prev) => [
          tileFromArtifact(artifact, preset.aspect),
          ...prev.filter((t) => t.status !== "generating"),
        ]);
        toast.success("Изображение готово", {
          description: artifact.title,
        });
      } catch (err) {
        setTiles((prev) => prev.filter((t) => t.status !== "generating"));
        const unconfigured =
          err instanceof ApiError && err.message === UNCONFIGURED_TOOL_MESSAGE;
        toast.error(
          err instanceof ApiError ? err.message : IMAGE_GEN_FAILED,
          {
            description: unconfigured
              ? IMAGE_GEN_UNCONFIGURED_HINT
              : IMAGE_GEN_FAILED_HINT,
          },
        );
      } finally {
        setGenerating(null);
      }
    },
    [effectiveId],
  );

  /* Вариации: повторная генерация по промпту существующей работы. */
  const makeVariations = useCallback(
    (tile: GalleryTile) => {
      if (generating) {
        toast.info("Студия уже рисует — дождитесь результата");
        return;
      }
      void runGenerate({
        prompt: tile.prompt,
        title: `${tile.title} — вариация`,
        size: presetByAspectId(tile.aspect),
      });
    },
    [generating, runGenerate],
  );

  /* Избранное — оптимистично, с откатом при ошибке. */
  const toggleFavorite = useCallback(
    async (id: string) => {
      const tile = tiles.find((t) => t.id === id);
      if (!tile) return;
      const next = !tile.favorite;
      setTiles((prev) =>
        prev.map((t) => (t.id === id ? { ...t, favorite: next } : t)),
      );
      try {
        await api.updateArtifact(id, { favorite: next });
      } catch {
        setTiles((prev) =>
          prev.map((t) => (t.id === id ? { ...t, favorite: !next } : t)),
        );
        toast.error("Не удалось обновить избранное");
      }
    },
    [tiles],
  );

  /* Удаление — оптимистично, с откатом при ошибке. */
  const removeTile = useCallback(
    async (id: string) => {
      const snapshot = tiles;
      setTiles((prev) => prev.filter((t) => t.id !== id));
      try {
        await api.deleteArtifact(id);
        toast.success("Работа удалена");
      } catch {
        setTiles(snapshot);
        toast.error("Не удалось удалить работу");
      }
    },
    [tiles],
  );

  const visibleTiles = useMemo(() => {
    const pending = generating
      ? [pendingTile(generating.prompt, generating.aspect, generating.sizeLabel)]
      : [];
    let list = [...pending, ...tiles];

    if (filter === "favorites") list = list.filter((t) => t.favorite);
    else if (filter === "image" || filter === "portrait")
      list = list.filter((t) => t.kind === filter);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.prompt.toLowerCase().includes(q),
      );
    }

    const sorted = [...list];
    if (sort === "old") sorted.reverse();
    else if (sort === "title")
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    return sorted;
  }, [tiles, generating, filter, query, sort]);

  const galleryEmpty =
    tiles.length === 0 && !query.trim() && filter === "all"
      ? `${IMAGE_GALLERY_EMPTY} — ${IMAGE_GALLERY_EMPTY_HINT}`
      : IMAGE_GALLERY_FILTER_EMPTY;

  const counts = useMemo(
    () => ({
      all: tiles.length,
      favorites: tiles.filter((t) => t.favorite).length,
      image: tiles.filter((t) => t.kind === "image").length,
      portrait: tiles.filter((t) => t.kind === "portrait").length,
    }),
    [tiles],
  );

  const drawerTile = useMemo(
    () => visibleTiles.find((t) => t.id === drawerTileId) ??
      tiles.find((t) => t.id === drawerTileId) ?? null,
    [visibleTiles, tiles, drawerTileId],
  );

  const openTile = (id: string) => {
    setDrawerTileId(id);
    setDrawerOpen(true);
  };

  /* Глобальный экран без воркспейса. */
  if (!workspaceId) {
    return (
      <section
        aria-label="Изображения"
        className="flex h-full min-w-0 flex-1 flex-col bg-background"
      >
        <ModuleHeader
          icon={ImagePlus}
          title="Изображения"
          description="Иллюстрации, обложки и концепты по текстовому описанию"
          stage="beta"
          onOpenMobileNav={onOpenMobileNav}
        />
        <main className="vf-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
          <GenerationPanel
            projectId={effectiveId}
            busy={generating !== null}
            generating={generating}
            onGenerate={(request) => void runGenerate(request)}
          />
          <section aria-label="Выбор воркспейса" className="rounded-xl border bg-card p-4">
            <h2 className="text-sm font-medium">Галерея какого воркспейса?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Генерация и галерея живут внутри воркспейса — выберите, куда рисуем.
            </p>
            <WorkspacePickerStatus
              loading={!workspaceId && wsLoading}
              error={!workspaceId && wsError}
              empty={!workspaceId && !wsLoading && !wsError && workspaces.length === 0}
              onRetry={loadWorkspaces}
            >
              {workspaces.map((ws) => {
                  const Meta = WORKSPACE_TYPE_META[ws.type];
                  const Icon = Meta.icon;
                  return (
                    <SelectableChip
                      key={ws.id}
                      label={ws.name}
                      icon={Icon}
                      selected={pickedId === ws.id}
                      count={ws.counts.images}
                      onClick={() => setPickedId(pickedId === ws.id ? null : ws.id)}
                      className="max-w-full"
                    />
                  );
                })}
            </WorkspacePickerStatus>
          </section>
          {effectiveId ? (
            <>
              <FilterBar
                query={query}
                onQueryChange={setQuery}
                filter={filter}
                onFilterChange={setFilter}
                counts={counts}
                sort={sort}
                onSortChange={setSort}
                count={visibleTiles.length}
                disabled={loading}
              />
              {loadError ? (
                <GalleryLoadError
                  message={loadError}
                  hint={IMAGE_GALLERY_LOAD_ERROR_HINT}
                  onRetry={() => void loadGallery()}
                />
              ) : (
                <GalleryGrid
                  tiles={visibleTiles}
                  loading={loading}
                  emptyLabel={galleryEmpty}
                  onOpen={openTile}
                  onVariations={makeVariations}
                  onToggleFavorite={(id) => void toggleFavorite(id)}
                  onDelete={(id) => void removeTile(id)}
                />
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
              <Images
                className="size-8 text-muted-foreground/50"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                Выберите воркспейс — покажем его галерею
              </p>
            </div>
          )}
        </main>
        <TileDrawer
          tile={drawerTile}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onVariations={makeVariations}
          onToggleFavorite={(id) => void toggleFavorite(id)}
          onDelete={(id) => void removeTile(id)}
        />
      </section>
    );
  }

  /* Вкладка воркспейса. */
  return (
    <section
      aria-label="Изображения"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={ImagePlus}
        title="Изображения"
        description="Иллюстрации, обложки и концепты по текстовому описанию"
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <GenerationPanel
          projectId={effectiveId}
          busy={generating !== null}
          generating={generating}
          onGenerate={(request) => void runGenerate(request)}
        />
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
          sort={sort}
          onSortChange={setSort}
          count={visibleTiles.length}
          disabled={loading}
        />
        {loadError ? (
          <GalleryLoadError
            message={loadError}
            hint={IMAGE_GALLERY_LOAD_ERROR_HINT}
            onRetry={() => void loadGallery()}
          />
        ) : (
          <GalleryGrid
            tiles={visibleTiles}
            loading={loading}
            emptyLabel={galleryEmpty}
            onOpen={openTile}
            onVariations={makeVariations}
            onToggleFavorite={(id) => void toggleFavorite(id)}
            onDelete={(id) => void removeTile(id)}
          />
        )}
      </main>

      <TileDrawer
        tile={drawerTile}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onVariations={makeVariations}
        onToggleFavorite={(id) => void toggleFavorite(id)}
        onDelete={(id) => void removeTile(id)}
      />
    </section>
  );
}

function GalleryLoadError({
  message,
  hint,
  onRetry,
}: {
  message: string;
  hint: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Повторить
      </Button>
    </div>
  );
}

/** Пресет размера по известной пропорции плитки (для «Вариаций»). */
function presetByAspectId(aspect: GalleryTile["aspect"]): string {
  const map: Record<GalleryTile["aspect"], string> = {
    square: "1024x1024",
    landscape: "1152x864",
    portrait: "864x1152",
    wide: "1440x720",
    tall: "720x1440",
  };
  return map[aspect];
}
