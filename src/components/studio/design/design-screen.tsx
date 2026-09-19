"use client";

/**
 * DesignScreen v2 (Фаза A) — «Дизайн» на живых данных БД.
 * Две вкладки: «Мудборд» (все image/portrait воркспейса; stage "design"
 * = в мудборде, emerald-рамка) и «Стиль» (LLM-палитра стиля —
 * mood, 5–6 цветов с копией hex, пара шрифтов, совет).
 * Вкладка воркспейса: workspaceId от шва workspace-tabs.
 * Глобальный экран: чипы выбора воркспейса (counts.images).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Images,
  Palette as PaletteIcon,
  PenTool,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  ModuleHeader,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { WorkspacePickerStatus } from "@/components/studio/shared/workspace-picker-status";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api";
import { briefFromArtifact, paletteFromArtifact } from "@/lib/palette";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { useAppUi } from "@/lib/store";
import type { ArtifactDto } from "@/lib/workspace-types";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import { SelectableChip } from "../images/chip";
import { MoodboardTab, type GeneratingInfo } from "./moodboard-tab";
import { StyleTab, type LoadedPalette } from "./style-tab";
import { RasterEditor } from "./raster-editor";
import { LayoutEditor } from "./layout-editor";
import {
  boardPresetById,
  boardTileFromArtifact,
  type FrameRequest,
} from "./palette-data";

type DesignTab = "moodboard" | "style" | "raster" | "layout";

export function DesignScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  const { workspaces, loading: wsLoading, error: wsError, load: loadWorkspaces } =
    useWorkspaces();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const effectiveId = workspaceId ?? pickedId;

  /* Все артефакты выбранного воркспейса (одним запросом). */
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const workspaceVersion = useAppUi((s) => s.workspaceVersion);
  const designSourceUrl = useAppUi((s) => s.designSourceUrl);

  const [tab, setTab] = useState<DesignTab>(
    designSourceUrl ? "raster" : "moodboard",
  );
  const [generating, setGenerating] = useState<GeneratingInfo | null>(null);
  const [paletteBusy, setPaletteBusy] = useState(false);

  useEffect(() => {
    if (designSourceUrl) setTab("raster");
  }, [designSourceUrl]);

  /* Загрузка артефактов воркспейса. */
  const loadArtifacts = useCallback(async () => {
    if (!effectiveId) {
      setArtifacts([]);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const list = await api.listArtifacts(effectiveId);
      setArtifacts(list);
    } catch (err) {
      setArtifacts([]);
      setLoadError(
        err instanceof ApiError ? err.message : "Не удалось загрузить дизайн",
      );
    } finally {
      setLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    void loadArtifacts();
  }, [loadArtifacts, workspaceVersion]);

  /* Производные данные: плитки мудборда + палитра стиля. */
  const boardTiles = useMemo(
    () =>
      artifacts
        .filter((a) => a.type === "image" || a.type === "portrait")
        .map(boardTileFromArtifact),
    [artifacts],
  );

  const loadedPalette = useMemo<LoadedPalette | null>(() => {
    for (const a of artifacts) {
      const palette = paletteFromArtifact(a);
      if (palette) {
        return {
          palette,
          createdAt: a.createdAt,
          brief: briefFromArtifact(a),
        };
      }
    }
    return null;
  }, [artifacts]);

  /* Новые артефакты кладём наверх — но только если воркспейс не сменился. */
  const prependArtifact = useCallback((artifact: ArtifactDto) => {
    setArtifacts((prev) =>
      prev.length === 0 || prev[0].projectId === artifact.projectId
        ? [artifact, ...prev.filter((a) => a.id !== artifact.id)]
        : prev,
    );
  }, []);

  /* Генерация кадра → api.aiGenerateImage со stage "design". */
  const runGenerate = useCallback(
    async (request: FrameRequest) => {
      if (!effectiveId) return;
      const preset = boardPresetById(request.size);
      setGenerating({
        prompt: request.prompt,
        sizeLabel: preset.size,
        aspect: preset.aspect,
      });
      try {
        const artifact = await api.aiGenerateImage({
          projectId: effectiveId,
          prompt: request.prompt,
          size: request.size,
          stage: "design",
        });
        prependArtifact(artifact);
        toast.success("Кадр готов и уже в мудборде", {
          description: artifact.title,
        });
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Генерация не удалась",
          { description: "Попробуйте ещё раз — обычно это помогает." },
        );
      } finally {
        setGenerating(null);
      }
    },
    [effectiveId, prependArtifact],
  );

  /* Мудборд: stage "design" ⇄ null — оптимистично с откатом. */
  const toggleBoard = useCallback(
    async (id: string) => {
      const current = artifacts.find((a) => a.id === id);
      if (!current) return;
      const next = current.stage === "design" ? null : "design";
      setArtifacts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, stage: next } : a)),
      );
      try {
        await api.updateArtifact(id, { stage: next });
      } catch {
        setArtifacts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, stage: current.stage } : a)),
        );
        toast.error("Не удалось обновить мудборд");
      }
    },
    [artifacts],
  );

  /* Удаление — оптимистично с откатом. */
  const removeArtifact = useCallback(
    async (id: string) => {
      const snapshot = artifacts;
      setArtifacts((prev) => prev.filter((a) => a.id !== id));
      try {
        await api.deleteArtifact(id);
        toast.success("Работа удалена");
      } catch {
        setArtifacts(snapshot);
        toast.error("Не удалось удалить работу");
      }
    },
    [artifacts],
  );

  /* Палитра стиля → POST /api/ai/palette (обновляет карту). */
  const generatePalette = useCallback(
    async (brief: string) => {
      if (!effectiveId || paletteBusy) return;
      setPaletteBusy(true);
      try {
        const { artifact, palette } = await api.aiGeneratePalette({
          projectId: effectiveId,
          brief: brief || undefined,
        });
        prependArtifact(artifact);
        setTab("style");
        toast.success("Палитра собрана", {
          description: palette.mood || "Карта стиля обновлена",
        });
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Не удалось собрать палитру",
          { description: "Попробуйте ещё раз или уточните бриф." },
        );
      } finally {
        setPaletteBusy(false);
      }
    },
    [effectiveId, paletteBusy, prependArtifact],
  );

  /* ── Разметка ── */

  const tabs = (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as DesignTab)}
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      <TabsList className="shrink-0 self-start">
        <TabsTrigger value="moodboard">
          <Images className="size-4" aria-hidden="true" />
          Мудборд
        </TabsTrigger>
        <TabsTrigger value="style">
          <PaletteIcon className="size-4" aria-hidden="true" />
          Стиль
        </TabsTrigger>
        <TabsTrigger value="raster">
          <PenTool className="size-4" aria-hidden="true" />
          Растр
        </TabsTrigger>
        <TabsTrigger value="layout">
          <PenTool className="size-4" aria-hidden="true" />
          Макет
        </TabsTrigger>
      </TabsList>
      <TabsContent value="moodboard" className="flex min-h-0 flex-1 flex-col">
        <MoodboardTab
          tiles={boardTiles}
          loading={loading}
          generating={generating}
          onGenerate={(request) => void runGenerate(request)}
          onToggleBoard={(id) => void toggleBoard(id)}
          onDelete={(id) => void removeArtifact(id)}
        />
      </TabsContent>
      <TabsContent value="style" className="flex min-h-0 flex-1 flex-col">
        <StyleTab
          loaded={loadedPalette}
          loading={loading}
          busy={paletteBusy}
          onGenerate={(brief) => void generatePalette(brief)}
        />
      </TabsContent>
      <TabsContent value="raster" className="flex min-h-0 flex-1 flex-col">
        {effectiveId ? (
          <RasterEditor workspaceId={effectiveId} imageUrl={designSourceUrl} />
        ) : null}
      </TabsContent>
      <TabsContent value="layout" className="flex min-h-0 flex-1 flex-col">
        {effectiveId ? <LayoutEditor workspaceId={effectiveId} /> : null}
      </TabsContent>
    </Tabs>
  );

  const content = loadError ? (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center"
    >
      <p className="text-sm text-muted-foreground">{loadError}</p>
      <Button size="sm" variant="outline" onClick={() => void loadArtifacts()}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Повторить
      </Button>
    </div>
  ) : effectiveId ? (
    tabs
  ) : (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
      <PaletteIcon
        className="size-8 text-muted-foreground/50"
        aria-hidden="true"
      />
      <p className="text-sm text-muted-foreground">
        Выберите воркспейс — покажем его мудборд и палитру стиля
      </p>
    </div>
  );

  return (
    <section
      aria-label="Дизайн"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={PenTool}
        title="Дизайн"
        description="Мудборд, растр (Photoshop-lite) и макет (Figma-lite)"
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      />

      {/* Глобальный экран скроллится целиком; вкладка воркспейса —
          внутренние скроллы (сетка/карта). */}
      <main
        className={
          workspaceId
            ? "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6"
            : "vf-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6"
        }
      >
        {!workspaceId ? (
          <section
            aria-label="Выбор воркспейса"
            className="shrink-0 rounded-xl border bg-card p-4"
          >
            <h2 className="text-sm font-medium">Дизайн какого воркспейса?</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Мудборд и палитра живут внутри воркспейса — выберите, где
              собираем стиль.
            </p>
            <WorkspacePickerStatus
              loading={!workspaceId && wsLoading}
              error={!workspaceId && wsError}
              empty={!workspaceId && !wsLoading && !wsError && workspaces.length === 0}
              onRetry={loadWorkspaces}
            >
              {workspaces.map((ws) => {
                  const Icon = WORKSPACE_TYPE_META[ws.type].icon;
                  return (
                    <SelectableChip
                      key={ws.id}
                      label={ws.name}
                      icon={Icon}
                      selected={pickedId === ws.id}
                      count={ws.counts.images}
                      onClick={() =>
                        setPickedId(pickedId === ws.id ? null : ws.id)
                      }
                      className="max-w-full"
                    />
                  );
                })}
            </WorkspacePickerStatus>
          </section>
        ) : null}

        {content}
      </main>
    </section>
  );
}
