"use client";

/**
 * StoryboardWorkspace — контент модуля «Видео» для конкретного воркспейса
 * (Task 5-b). Выбор сценария (документ kind "script", чипы + «Добавить
 * сцену»), список сцен с генерацией кадров и озвучкой, sticky-плеер
 * сборки и статус «Готово к сборке: X/Y». Используется и вкладкой
 * воркспейса, и глобальным экраном (после выбора воркспейса чипом).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Clapperboard,
  Film,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  ArtifactDto,
  DocumentDto,
  DocumentSectionDto,
} from "@/lib/workspace-types";
import { SceneCard } from "./scene-card";
import { StoryboardPlayer } from "./storyboard-player";
import {
  SCENE_IMAGE_SIZE,
  buildScenes,
  sceneReady,
  sceneStage,
  voiceStage,
} from "./video-data";

export function StoryboardWorkspace({ projectId }: { projectId: string }) {
  const [scripts, setScripts] = useState<DocumentDto[] | null>(null);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [sections, setSections] = useState<DocumentSectionDto[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [creatingScript, setCreatingScript] = useState(false);
  const [addingScene, setAddingScene] = useState(false);
  const [imageBusy, setImageBusy] = useState<Record<string, true>>({});
  const [voiceBusy, setVoiceBusy] = useState<Record<string, true>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  /* Плеер сборки. */
  const [playIndex, setPlayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoadError(null);
    try {
      const [documents, arts] = await Promise.all([
        api.listDocuments(projectId),
        api.listArtifacts(projectId),
      ]);
      setArtifacts(arts);
      const found = documents.filter((d) => d.kind === "script");
      setScripts(found);
      setScriptId((prev) =>
        prev && found.some((d) => d.id === prev) ? prev : (found[0]?.id ?? null),
      );
    } catch (err) {
      setScripts([]);
      setArtifacts([]);
      setLoadError(
        err instanceof ApiError ? err.message : "Не удалось загрузить сценарии",
      );
    }
  }, [projectId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  /* Другой воркспейс — сброс плеера. */
  useEffect(() => {
    setPlayIndex(0);
    setPlaying(false);
  }, [projectId]);

  /* Секции выбранного сценария. */
  useEffect(() => {
    if (!scriptId) {
      setSections([]);
      return undefined;
    }
    let cancelled = false;
    setSectionsLoading(true);
    api
      .getDocument(scriptId)
      .then((doc) => {
        if (cancelled) return;
        setSections([...(doc.sections ?? [])].sort((a, b) => a.order - b.order));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSections([]);
        toast.error("Не удалось загрузить сцены", {
          description: err instanceof ApiError ? err.message : undefined,
        });
      })
      .finally(() => {
        if (!cancelled) setSectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scriptId]);

  const scenes = useMemo(() => buildScenes(sections, artifacts), [
    sections,
    artifacts,
  ]);
  const readyCount = scenes.filter(sceneReady).length;
  const playable = scenes.some((s) => s.imageUrl || s.voiceUrl);
  const clampedIndex =
    scenes.length > 0 ? Math.min(playIndex, scenes.length - 1) : 0;

  const handleIndexChange = useCallback((next: number) => {
    setPlayIndex(next);
  }, []);
  const handlePlayingChange = useCallback((next: boolean) => {
    setPlaying(next);
  }, []);
  const playFrom = useCallback((index: number) => {
    setPlayIndex(index);
    setPlaying(true);
  }, []);

  const selectScript = (id: string) => {
    if (scriptId === id) return;
    setScriptId(id);
    setPlayIndex(0);
    setPlaying(false);
  };

  /* Сценарий раскадровки + 4 сцены-заготовки (последовательно — ради order). */
  const createScript = async () => {
    if (creatingScript) return;
    setCreatingScript(true);
    try {
      const doc = await api.createDocument(projectId, {
        title: "Раскадровка фильма",
        kind: "script",
        description: "Сцены для сборки видео: кадр + озвучка",
      });
      /* Сервер создаёт первую главу «Глава 1» — она становится «Сценой 1». */
      const first = doc.sections?.[0];
      const created: DocumentSectionDto[] = [];
      if (first) {
        created.push(await api.updateSection(first.id, { title: "Сцена 1" }));
      } else {
        created.push(await api.createSection(doc.id, "Сцена 1"));
      }
      for (let i = 2; i <= 4; i += 1) {
        created.push(await api.createSection(doc.id, `Сцена ${i}`));
      }
      setScripts((prev) => [...(prev ?? []), doc]);
      setScriptId(doc.id);
      setSections(created.sort((a, b) => a.order - b.order));
      toast.success("Сценарий создан", {
        description: "Четыре сцены-заготовки — напишите текст и соберите фильм.",
      });
    } catch (err) {
      toast.error("Не удалось создать сценарий", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setCreatingScript(false);
    }
  };

  /* Добавить сцену в текущий сценарий. */
  const addScene = async () => {
    if (!scriptId || addingScene) return;
    setAddingScene(true);
    try {
      const section = await api.createSection(
        scriptId,
        `Сцена ${sections.length + 1}`,
      );
      setSections((prev) => [...prev, section]);
      toast.success(`Сцена ${sections.length + 1} добавлена`);
    } catch (err) {
      toast.error("Не удалось добавить сцену", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setAddingScene(false);
    }
  };

  /* Автосейв текста сцены (приходит из SceneCard после дебаунса). */
  const saveContent = useCallback(
    async (id: string, content: string): Promise<boolean> => {
      try {
        const updated = await api.updateSection(id, { content });
        setSections((prev) => prev.map((s) => (s.id === id ? updated : s)));
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  /* Генерация кадра сцены (≈30–45 сек, спиннер на кнопке). */
  const generateFrame = useCallback(
    async (sectionId: string, prompt: string) => {
      if (prompt.length < 3) {
        toast.error("Нечего рисовать", {
          description: "Напишите текст сцены или свой промпт кадра.",
        });
        return;
      }
      const scene = scenes.find((s) => s.section.id === sectionId);
      setImageBusy((prev) => ({ ...prev, [sectionId]: true }));
      try {
        const artifact = await api.aiGenerateImage({
          projectId,
          prompt,
          title: `Кадр: ${scene?.section.title ?? "Сцена"}`,
          stage: sceneStage(sectionId),
          size: SCENE_IMAGE_SIZE,
        });
        setArtifacts((prev) => [...prev, artifact]);
        toast.success("Кадр готов", {
          description: scene?.section.title ?? undefined,
        });
      } catch (err) {
        toast.error("Кадр не сгенерировался", {
          description:
            err instanceof ApiError
              ? err.message
              : "Попробуйте ещё раз — обычно это помогает.",
        });
      } finally {
        setImageBusy((prev) => {
          const next = { ...prev };
          delete next[sectionId];
          return next;
        });
      }
    },
    [projectId, scenes],
  );

  /* Озвучка сцены: TTS → привязка артефакта к сцене через stage-метку. */
  const generateVoice = useCallback(
    async (sectionId: string, text: string, voice: string) => {
      if (text.length < 3) {
        toast.error("Нечего читать", {
          description: "Напишите текст сцены — его прочитает диктор.",
        });
        return;
      }
      const scene = scenes.find((s) => s.section.id === sectionId);
      setVoiceBusy((prev) => ({ ...prev, [sectionId]: true }));
      try {
        const created = await api.aiTts({
          projectId,
          text,
          title: `Озвучка: ${scene?.section.title ?? "Сцена"}`,
          voice,
        });
        const artifact = await api.updateArtifact(created.id, {
          stage: voiceStage(sectionId),
        });
        setArtifacts((prev) => [...prev, artifact]);
        toast.success("Озвучка готова", {
          description: scene?.section.title ?? undefined,
        });
      } catch (err) {
        toast.error("Озвучка не удалась", {
          description: err instanceof ApiError ? err.message : "Попробуйте ещё раз.",
        });
      } finally {
        setVoiceBusy((prev) => {
          const next = { ...prev };
          delete next[sectionId];
          return next;
        });
      }
    },
    [projectId, scenes],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Сценарии раскадровки */}
      <div className="shrink-0 border-b bg-muted/30 px-4 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-1.5">
          <Film className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {scripts === null ? (
            <div className="flex flex-1 gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-7 w-32 rounded-full" />
              ))}
            </div>
          ) : (
            <div className="vf-scroll-x flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
              {scripts.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => selectScript(doc.id)}
                  aria-current={scriptId === doc.id}
                  title={doc.title}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    scriptId === doc.id
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                  )}
                >
                  <span className="truncate">{doc.title}</span>
                </button>
              ))}
            </div>
          )}
          {scriptId ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={() => void addScene()}
              disabled={addingScene}
              aria-label="Добавить сцену в сценарий"
            >
              {addingScene ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-3.5" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">Добавить сцену</span>
              <span className="sm:hidden">Сцена</span>
            </Button>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button size="sm" variant="outline" onClick={() => void loadWorkspace()}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Повторить
          </Button>
        </div>
      ) : !scriptId ? (
        /* Нет сценария раскадровки — создание */
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed p-8 text-center">
            <span
              className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Clapperboard className="size-6" />
            </span>
            <div>
              <h2 className="text-base font-semibold">
                Создать сценарий раскадровки
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Сценарий — это список сцен. В каждой сцене: текст для диктора,
                сгенерированный кадр и озвучка. Из них плеер соберёт фильм.
              </p>
            </div>
            <Button onClick={() => void createScript()} disabled={creatingScript}>
              {creatingScript ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Создать сценарий
            </Button>
          </div>
        </div>
      ) : (
        <main
          className="vf-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          aria-label="Сцены раскадровки"
        >
          {sectionsLoading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-52 w-full rounded-xl" />
              ))}
            </div>
          ) : scenes.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                В сценарии пока нет ни одной сцены
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void addScene()}
                disabled={addingScene}
              >
                {addingScene ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                Добавить сцену
              </Button>
            </div>
          ) : (
            <>
              {/* Плеер сборки + статус — sticky сверху на достаточно высоких
                  экранах (на низких прокручивается вместе со сценами). */}
              <div className="relative z-10 -mx-4 -mt-4 bg-background/95 px-4 pb-3 pt-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 [@media(min-height:800px)]:sticky [@media(min-height:800px)]:top-0">
                {playable ? (
                  <StoryboardPlayer
                    scenes={scenes}
                    index={clampedIndex}
                    playing={playing}
                    onIndexChange={handleIndexChange}
                    onPlayingChange={handlePlayingChange}
                  />
                ) : (
                  <div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-card/50 px-6 text-center">
                    <Clapperboard
                      className="size-5 text-muted-foreground/50"
                      aria-hidden="true"
                    />
                    <p className="text-xs text-muted-foreground">
                      Пока нечего смотреть — сгенерируйте кадр или озвучку любой
                      сцены
                    </p>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                  <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
                    Готово к сборке: {readyCount} из {scenes.length} сцен (кадр + озвучка)
                  </span>
                  <Progress
                    value={scenes.length ? (readyCount / scenes.length) * 100 : 0}
                    className="h-1.5"
                    aria-label="Готовность фильма"
                  />
                </div>
              </div>

              {/* Список сцен */}
              <div className="mt-4 flex flex-col gap-3">
                {scenes.map((scene, i) => (
                  <SceneCard
                    key={scene.section.id}
                    scene={scene}
                    index={i}
                    imageBusy={Boolean(imageBusy[scene.section.id])}
                    voiceBusy={Boolean(voiceBusy[scene.section.id])}
                    onSaveContent={saveContent}
                    onGenerateFrame={(id, prompt) => void generateFrame(id, prompt)}
                    onGenerateVoice={(id, text, voice) =>
                      void generateVoice(id, text, voice)
                    }
                    onPlayFrom={playFrom}
                  />
                ))}
              </div>
            </>
          )}
        </main>
      )}
    </div>
  );
}
