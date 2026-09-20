"use client";

/**
 * StoryboardWorkspace — контент модуля «Видео» для конкретного воркспейса
 * (Task 5-b). Выбор сценария (документ kind "script", чипы + «Добавить
 * сцену»), список сцен с генерацией кадров и озвучкой, sticky-плеер
 * сборки и статус «Готово к сборке: X/Y». Используется и вкладкой
 * воркспейса, и глобальным экраном (после выбора воркспейса чипом).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Film } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import {
  AUDIO_TTS_FAILED,
  AUDIO_TTS_FAILED_HINT,
  AUDIO_TTS_UNCONFIGURED_HINT,
  playableAudioSrc,
} from "@/lib/audio-copy";
import {
  IMAGE_GEN_FAILED,
  IMAGE_GEN_FAILED_HINT,
  IMAGE_GEN_UNCONFIGURED_HINT,
  displayableImageSrc,
} from "@/lib/image-copy";
import type {
  ArtifactDto,
  DocumentDto,
  DocumentSectionDto,
} from "@/lib/workspace-types";
import { AssembleDialog } from "./assemble-dialog";
import type { FilmSceneSource } from "./film-compiler";
import { SceneCard } from "./scene-card";
import {
  LoadErrorCard,
  NoPlayableCard,
  NoScenesCard,
  NoScriptCard,
  ScriptChipsBar,
} from "./storyboard-panes";
import { StoryboardPlayer } from "./storyboard-player";
import {
  VIDEO_STORYBOARD_LOAD_ERROR,
  storyboardListView,
} from "@/lib/video-copy";
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

  /* Диалог «Сборка фильма» (настоящий WebM-рендер). */
  const [assembleOpen, setAssembleOpen] = useState(false);

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
        err instanceof ApiError ? err.message : VIDEO_STORYBOARD_LOAD_ERROR,
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
  /* Сцены для компилятора фильма (текст = содержимое секции). */
  const filmScenes = useMemo<FilmSceneSource[]>(
    () =>
      scenes.map((s) => ({
        imageUrl: s.imageUrl,
        audioUrl: s.voiceUrl,
        title: s.section.title,
        text: s.section.content,
      })),
    [scenes],
  );

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
        if (!displayableImageSrc(artifact)) {
          toast.error(IMAGE_GEN_FAILED, { description: IMAGE_GEN_FAILED_HINT });
          return;
        }
        setArtifacts((prev) => [...prev, artifact]);
        toast.success("Кадр готов", {
          description: scene?.section.title ?? undefined,
        });
      } catch (err) {
        const unconfigured =
          err instanceof ApiError && err.message === UNCONFIGURED_TOOL_MESSAGE;
        toast.error(IMAGE_GEN_FAILED, {
          description: unconfigured
            ? IMAGE_GEN_UNCONFIGURED_HINT
            : err instanceof ApiError
              ? err.message
              : IMAGE_GEN_FAILED_HINT,
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
        if (!playableAudioSrc(created)) {
          toast.error(AUDIO_TTS_FAILED, { description: AUDIO_TTS_FAILED_HINT });
          return;
        }
        const artifact = await api.updateArtifact(created.id, {
          stage: voiceStage(sectionId),
        });
        if (!playableAudioSrc(artifact)) {
          toast.error(AUDIO_TTS_FAILED, { description: AUDIO_TTS_FAILED_HINT });
          return;
        }
        setArtifacts((prev) => [...prev, artifact]);
        toast.success("Озвучка готова", {
          description: scene?.section.title ?? undefined,
        });
      } catch (err) {
        const unconfigured =
          err instanceof ApiError && err.message === UNCONFIGURED_TOOL_MESSAGE;
        toast.error(
          err instanceof ApiError ? err.message : AUDIO_TTS_FAILED,
          {
            description: unconfigured
              ? AUDIO_TTS_UNCONFIGURED_HINT
              : AUDIO_TTS_FAILED_HINT,
          },
        );
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

  /* Фильм собран и загружен в библиотеку (AssembleDialog). */
  const handleAssembled = useCallback((artifact: ArtifactDto) => {
    setArtifacts((prev) => [artifact, ...prev]);
    toast.success("Фильм собран и в библиотеке");
  }, []);

  const listView = storyboardListView(scripts, loadError);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Сценарии раскадровки */}
      {listView === "error" ? null : (
        <ScriptChipsBar
          scripts={scripts}
          scriptId={scriptId}
          onSelect={selectScript}
          onAddScene={() => void addScene()}
          addingScene={addingScene}
        />
      )}

      {listView === "error" ? (
        <LoadErrorCard message={loadError ?? VIDEO_STORYBOARD_LOAD_ERROR} onRetry={() => void loadWorkspace()} />
      ) : listView === "loading" ? (
        <main className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-6" aria-busy="true" aria-label="Загрузка раскадровки">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </main>
      ) : listView === "empty" || !scriptId ? (
        <NoScriptCard
          creating={creatingScript}
          onCreate={() => void createScript()}
        />
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
            <NoScenesCard adding={addingScene} onAdd={() => void addScene()} />
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
                  <NoPlayableCard />
                )}
                <div className="mt-3 flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                  <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
                    Готово к сборке: {readyCount} из {scenes.length} сцен (кадр + озвучка)
                  </span>
                  <Progress
                    value={scenes.length ? (readyCount / scenes.length) * 100 : 0}
                    className="h-1.5 min-w-0 flex-1"
                    aria-label="Готовность фильма"
                  />
                  <Button
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 border-emerald-600/50 bg-emerald-500/10 px-2.5 text-xs text-emerald-700 hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400"
                    onClick={() => setAssembleOpen(true)}
                    aria-label="Собрать фильм из сцен раскадровки"
                  >
                    <Film className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Собрать фильм</span>
                  </Button>
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

      {/* Диалог рендера фильма — только при выбранном сценарии со сценами. */}
      {scriptId && filmScenes.length > 0 ? (
        <AssembleDialog
          open={assembleOpen}
          onOpenChange={setAssembleOpen}
          projectId={projectId}
          scriptTitle={
            scripts?.find((doc) => doc.id === scriptId)?.title ?? "Раскадровка"
          }
          scenes={filmScenes}
          onAssembled={handleAssembled}
        />
      ) : null}
    </div>
  );
}
