"use client";

/**
 * Видео (Task 5-b) — студия раскадровки: сцены с реальными кадрами
 * (AI-генерация изображений) и озвучкой (TTS) + браузерный плеер,
 * проигрывающий «фильм» из сцен.
 *
 * Вкладка воркспейса (workspaceId из шва workspace-tabs) — сразу контент
 * сценария. Глобальный экран (без id) — выбор воркспейса чипами, затем
 * тот же контент (как в images-screen).
 */

import { useEffect, useState } from "react";
import { Clapperboard, Film, Scissors } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ModuleHeader,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { WorkspacePickerStatus } from "@/components/studio/shared/workspace-picker-status";
import { api } from "@/lib/api";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { cn } from "@/lib/utils";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import type { ArtifactDto } from "@/lib/workspace-types";
import { StoryboardWorkspace } from "./storyboard-workspace";
import { NleTimeline } from "./nle-timeline";

const VIDEO_DESCRIPTION =
  "Раскадровка, озвучка, монтажный стол и сборка фильма";

export function VideoScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  /* Глобальный экран без воркспейса: список воркспейсов для чипов. */
  const { workspaces, loading, error, load } = useWorkspaces();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const effectiveId = workspaceId ?? pickedId;

  return (
    <section
      aria-label="Видео"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Clapperboard}
        title="Видео"
        description={VIDEO_DESCRIPTION}
        stage="beta"
        onOpenMobileNav={onOpenMobileNav}
      />

      {workspaceId ? (
        <VideoStudio projectId={workspaceId} />
      ) : (
        /* Глобальный экран — выбор воркспейса чипами. */
        <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
          <section
            aria-label="Выбор воркспейса"
            className="shrink-0 rounded-xl border bg-card p-4"
          >
            <h2 className="text-sm font-medium">
              Раскадровку какого воркспейса открываем?
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Сцены и фильмы живут внутри воркспейса — выберите, где снимаем.
            </p>
            <WorkspacePickerStatus
              loading={!workspaceId && loading}
              error={!workspaceId && error}
              empty={!workspaceId && !loading && !error && workspaces.length === 0}
              onRetry={load}
            >
              {workspaces.map((ws) => {
                  const Icon = WORKSPACE_TYPE_META[ws.type].icon;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() =>
                        setPickedId(pickedId === ws.id ? null : ws.id)
                      }
                      aria-current={pickedId === ws.id}
                      title={ws.name}
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                        pickedId === ws.id
                          ? "border-primary/60 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{ws.name}</span>
                    </button>
                  );
                })}
            </WorkspacePickerStatus>
          </section>

          {effectiveId ? (
            <VideoStudio key={effectiveId} projectId={effectiveId} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
              <Film
                className="size-8 text-muted-foreground/50"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                Выберите воркспейс — откроем студию раскадровки
              </p>
            </div>
          )}
        </main>
      )}
    </section>
  );
}

function VideoStudio({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState("storyboard");
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .listArtifacts(projectId)
      .then((list) => {
        if (!cancelled) setArtifacts(list);
      })
      .catch(() => {
        if (!cancelled) setArtifacts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="shrink-0 border-b px-4 py-2">
        <TabsList>
          <TabsTrigger value="storyboard">
            <Film className="size-3.5" /> Раскадровка
          </TabsTrigger>
          <TabsTrigger value="nle">
            <Scissors className="size-3.5" /> Монтаж
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="storyboard" className="mt-0 min-h-0 flex-1">
        <StoryboardWorkspace projectId={projectId} />
      </TabsContent>
      <TabsContent value="nle" className="mt-0 min-h-0 flex-1 overflow-hidden p-4">
        <NleTimeline workspaceId={projectId} artifacts={artifacts} />
      </TabsContent>
    </Tabs>
  );
}
