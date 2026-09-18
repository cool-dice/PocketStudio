"use client";

/**
 * Экран «Аудио» — карманная звуковая студия (Фаза A: вкладка
 * «Озвучка» становится живой).
 *
 * Пять вкладок:
 *  - «Озвучка» — НАСТОЯЩИЙ TTS: текст → api.aiTts (голоса студии,
 *    скорость) → WAV-артефакт в БД + живая библиотека озвучек с
 *    <audio controls>-плеерами. Встроена в воркспейс (workspaceId)
 *    либо предлагает выбрать воркспейс чипами (глобальный вызов).
 *  - «Музыка» / «Подкаст» / «Шумы» — визуальные макеты (как было).
 *  - «Студия» — DAW-макет (дорожки/сэмплы/микшер, как было).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioWaveform,
  FolderOpen,
  Layers,
  Loader2,
  Mic,
  Music,
  Plus,
  Podcast,
  SlidersHorizontal,
  Waves,
} from "lucide-react";

import { ModuleHeader, WipBanner, type ModuleScreenProps } from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import type { WorkspaceDto } from "@/lib/workspace-types";
import { DawTab, type StemSource } from "./daw-tab";
import { MusicTab, NoiseTab, PodcastTab } from "./generation-panel";
import { NarrationLibrary } from "./narration-library";
import { NarrationPanel } from "./narration-panel";
import { PlayerBar } from "./player-bar";
import { SelectableChip } from "./chip";
import { TrackLibrary } from "./track-library";
import { TRACKS, type AudioTrack } from "./tracks-data";

const SPEEDS: readonly number[] = [0.75, 1, 1.25, 1.5];

const AUDIO_TABS = [
  { value: "voice", label: "Озвучка", icon: Mic },
  { value: "music", label: "Музыка", icon: Music },
  { value: "podcast", label: "Подкаст", icon: Podcast },
  { value: "noise", label: "Шумы", icon: Waves },
  { value: "studio", label: "Студия", icon: SlidersHorizontal },
] as const;

type AudioTabValue = (typeof AUDIO_TABS)[number]["value"];

export function AudioScreen({
  onOpenMobileNav,
  workspaceId,
}: ModuleScreenProps & { workspaceId?: string }) {
  /* ── Макет DAW (как раньше) ── */
  const [tracks] = useState<AudioTrack[]>(TRACKS);
  const [currentId, setCurrentId] = useState(TRACKS[1]!.id);
  const [playing, setPlaying] = useState(false);
  const [progressSec, setProgressSec] = useState(84); // 1:24 из 3:45
  const [volume, setVolume] = useState(72);
  const [speed, setSpeed] = useState(1);
  const [tab, setTab] = useState<AudioTabValue>("voice");

  /* «Разложить на дорожки»: фейковый прогресс → стемы в Студии */
  const [stems, setStems] = useState<StemSource | null>(null);
  const [stemming, setStemming] = useState<string | null>(null);
  const stemTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (stemTimerRef.current) clearTimeout(stemTimerRef.current);
  }, []);

  /* ── Живая озвучка (Фаза A) ── */
  // Глобальный вызов (без workspaceId) — воркспейс выбирается чипами.
  const [workspaces, setWorkspaces] = useState<WorkspaceDto[] | null>(null);
  const [pickedWorkspaceId, setPickedWorkspaceId] = useState<string | null>(null);
  const [libraryKey, setLibraryKey] = useState(0);

  const embeddedWorkspaceId = workspaceId ?? null;
  const activeWorkspaceId = embeddedWorkspaceId ?? pickedWorkspaceId;

  useEffect(() => {
    if (embeddedWorkspaceId) return;
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
  }, [embeddedWorkspaceId]);

  const current = useMemo(
    () => tracks.find((t) => t.id === currentId) ?? tracks[0]!,
    [tracks, currentId],
  );

  // Тик прогресса: раз в секунду, а плавность даёт CSS transition-width.
  // Дорожка закончилась — сразу переходим к следующей (setState внутри
  // колбэка интервала, а не в теле эффекта).
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      if (progressSec + 1 >= current.durationSec) {
        const idx = tracks.findIndex((t) => t.id === current.id);
        const next = tracks[(idx + 1) % tracks.length]!;
        setCurrentId(next.id);
        setProgressSec(0);
        return;
      }
      setProgressSec(progressSec + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [playing, progressSec, current, tracks]);

  const togglePlay = (id: string) => {
    if (id === currentId) {
      setPlaying((p) => !p);
      return;
    }
    setCurrentId(id);
    setProgressSec(0);
    setPlaying(true);
  };

  const selectTrack = (id: string) => {
    if (id === currentId) return;
    setCurrentId(id);
    setProgressSec(0);
  };

  const step = (dir: 1 | -1) => {
    const idx = tracks.findIndex((t) => t.id === current.id);
    const next = tracks[(idx + dir + tracks.length) % tracks.length]!;
    setCurrentId(next.id);
    setProgressSec(0);
  };

  const seek = (sec: number) =>
    setProgressSec(Math.max(0, Math.min(current.durationSec, Math.round(sec))));

  const cycleSpeed = () =>
    setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]!);

  const explodeToStems = (track: AudioTrack) => {
    if (stemming) return;
    setStemming(track.title);
    stemTimerRef.current = setTimeout(() => {
      stemTimerRef.current = null;
      setStemming(null);
      setStems({ title: track.title, gradient: track.gradient });
      setTab("studio");
    }, 1500);
  };

  const isStudio = tab === "studio";
  const isVoice = tab === "voice";
  // Плеер и мок-библиотека — только у макетных вкладок (не «Озвучка», не «Студия»).
  const isMockTab = !isStudio && !isVoice;

  return (
    <section
      aria-label="Аудио"
      className="relative flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={AudioWaveform}
        title="Аудио"
        description="Озвучка, музыка, подкасты и карманная DAW-студия"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Новая дорожка
        </Button>
      </ModuleHeader>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as AudioTabValue)}
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <TabsList className="shrink-0 self-start max-w-full overflow-x-auto">
            {AUDIO_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <t.icon className="size-4" aria-hidden="true" />
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Живая озвучка ── */}
          <TabsContent
            value="voice"
            className="mt-0 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto vf-scroll pr-0.5"
          >
            {!embeddedWorkspaceId ? (
              <section
                aria-label="Выбор воркспейса"
                className="shrink-0 rounded-xl border bg-card p-4 shadow-sm"
              >
                <p className="text-sm font-medium">Воркспейс озвучки</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Озвучки хранятся в библиотеке конкретного воркспейса — выберите, куда читать.
                </p>
                <div className="mt-2.5 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto vf-scroll">
                  {workspaces === null ? (
                    <>
                      <Skeleton className="h-7 w-36 rounded-full" />
                      <Skeleton className="h-7 w-28 rounded-full" />
                      <Skeleton className="h-7 w-32 rounded-full" />
                    </>
                  ) : workspaces.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Воркспейсов пока нет — создайте первый в разделе «Воркспейсы».
                    </p>
                  ) : (
                    workspaces.map((ws) => (
                      <SelectableChip
                        key={ws.id}
                        label={ws.name}
                        selected={pickedWorkspaceId === ws.id}
                        onClick={() => setPickedWorkspaceId(ws.id)}
                      />
                    ))
                  )}
                </div>
              </section>
            ) : null}

            {activeWorkspaceId ? (
              <>
                <NarrationPanel
                  workspaceId={activeWorkspaceId}
                  onCreated={() => setLibraryKey((k) => k + 1)}
                />
                <NarrationLibrary
                  workspaceId={activeWorkspaceId}
                  refreshKey={libraryKey}
                />
              </>
            ) : (
              <div className="flex min-h-40 flex-1 items-center justify-center rounded-xl border border-dashed p-6">
                <div className="flex max-w-sm flex-col items-center text-center">
                  <span
                    aria-hidden="true"
                    className="flex size-11 items-center justify-center rounded-xl bg-muted"
                  >
                    <FolderOpen className="size-5 text-muted-foreground" />
                  </span>
                  <p className="mt-3 text-sm font-medium">Выберите воркспейс</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Озвучка живёт в воркспейсе: текст прочитается вслух, а готовый трек
                    с плеером появится в библиотеке ниже.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Режимы генерации (макеты) ── */}
          <TabsContent value="music" className="mt-0 shrink-0">
            <section aria-label="Генерация музыки" className="rounded-xl border bg-card p-4 shadow-sm">
              <MusicTab />
            </section>
          </TabsContent>
          <TabsContent value="podcast" className="mt-0 shrink-0">
            <section aria-label="Генерация подкаста" className="rounded-xl border bg-card p-4 shadow-sm">
              <PodcastTab />
            </section>
          </TabsContent>
          <TabsContent value="noise" className="mt-0 shrink-0">
            <section aria-label="Генерация шумов" className="rounded-xl border bg-card p-4 shadow-sm">
              <NoiseTab />
            </section>
          </TabsContent>

          {/* ── DAW ── */}
          <TabsContent value="studio" className="mt-0 flex min-h-0 flex-1 flex-col">
            <DawTab stemSource={stems} />
          </TabsContent>
        </Tabs>

        {isMockTab ? (
          <>
            <WipBanner
              title="Визуальный макет"
              description="Реальное синтезирование музыки и шумов подключается на следующем этапе. Озвучка уже живая — вкладка «Озвучка»."
              features={["Живая озвучка", "Генеративная музыка", "Экспорт в MP3"]}
            />
            <TrackLibrary
              tracks={tracks}
              currentId={currentId}
              playing={playing}
              explodingTitle={stemming}
              onTogglePlay={togglePlay}
              onSelect={selectTrack}
              onExplodeToStems={explodeToStems}
            />
          </>
        ) : null}
      </main>

      {isMockTab ? (
        <PlayerBar
          track={current}
          playing={playing}
          progressSec={progressSec}
          volume={volume}
          speed={speed}
          onTogglePlay={() => setPlaying((p) => !p)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onSeek={seek}
          onVolumeChange={setVolume}
          onCycleSpeed={cycleSpeed}
        />
      ) : null}

      {/* Плашка «Разложить на стемы» */}
      {stemming ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 rounded-full border bg-card px-4 py-2.5 shadow-xl"
        >
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
          <span className="whitespace-nowrap text-sm">
            Раскладываем «{stemming}» на стемы…
          </span>
          <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>
      ) : null}
    </section>
  );
}
