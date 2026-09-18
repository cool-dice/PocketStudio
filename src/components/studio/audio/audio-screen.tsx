"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioWaveform, Layers, Loader2, Mic, Music, Plus, Podcast, SlidersHorizontal, Waves } from "lucide-react";

import { ModuleHeader, WipBanner, type ModuleScreenProps } from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DawTab, type StemSource } from "./daw-tab";
import { MusicTab, NoiseTab, PodcastTab, VoiceTab } from "./generation-panel";
import { PlayerBar } from "./player-bar";
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

/**
 * Экран «Аудио» — карманная звуковая студия.
 * Пять вкладок: озвучка, музыка, подкаст, шумы и DAW-студия.
 * Чистый визуальный макет: локальный state, без запросов к API.
 */
export function AudioScreen({ onOpenMobileNav }: ModuleScreenProps) {
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

          {/* ── Режимы генерации ── */}
          <TabsContent value="voice" className="mt-0 shrink-0">
            <section aria-label="Панель генерации аудио" className="rounded-xl border bg-card p-4 shadow-sm">
              <VoiceTab />
            </section>
          </TabsContent>
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

        {!isStudio ? (
          <>
            <WipBanner
              title="Визуальный макет"
              description="Реальное синтезирование речи, музыки и шумов подключается на следующем этапе."
              features={["Голоса студии", "Генеративная музыка", "Экспорт в MP3"]}
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

      {!isStudio ? (
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
