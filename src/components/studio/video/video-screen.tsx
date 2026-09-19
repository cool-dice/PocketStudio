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
import { Clapperboard, Film, Images, Scissors } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ModuleHeader,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import { cn } from "@/lib/utils";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import type { WorkspaceDto } from "@/lib/workspace-types";
import { StoryboardWorkspace } from "./storyboard-workspace";
import { NleTimeline } from "./nle-timeline";
import type { ArtifactDto } from "@/lib/workspace-types";

const VIDEO_DESCRIPTION =
  "Раскадровка, озвучка, монтажный стол и сборка фильма";

export function VideoScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  /* Глобальный экран без воркспейса: список воркспейсов для чипов. */
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[] | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const effectiveId = workspaceId ?? pickedId;
  const setMainArea = useAppUi((s) => s.setMainArea);

  useEffect(() => {
    if (workspaceId) return undefined;
    let cancelled = false;
    api
      .listWorkspaces()
      .then((list) => {
        if (!cancelled) setWorkspaces(list);
      })
      .catch(() => {
        if (!cancelled) setWorkspaces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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
            {workspaces === null ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton key={i} className="h-8 w-36 rounded-full" />
                ))}
              </div>
            ) : workspaces.length === 0 ? (
              <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
                <p className="text-sm text-muted-foreground">
                  Пока нет ни одного воркспейса — сначала создайте его.
                </p>
                <Button size="sm" onClick={() => setMainArea("workspaces")}>
                  <Images className="size-4" aria-hidden="true" />
                  К воркспейсам
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-1.5">
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
              </div>
            )}
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
