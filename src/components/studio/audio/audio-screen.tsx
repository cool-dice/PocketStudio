"use client";

import { useEffect, useMemo, useState } from "react";
import { AudioWaveform, Plus } from "lucide-react";

import { ModuleHeader, WipBanner, type ModuleScreenProps } from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";
import { GenerationPanel } from "./generation-panel";
import { PlayerBar } from "./player-bar";
import { TrackLibrary } from "./track-library";
import { TRACKS, type AudioTrack } from "./tracks-data";

const SPEEDS: readonly number[] = [0.75, 1, 1.25, 1.5];

/**
 * Экран «Аудио» — карманная звуковая студия.
 * Чистый визуальный макет: локальный state, без запросов к API.
 */
export function AudioScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [tracks] = useState<AudioTrack[]>(TRACKS);
  const [currentId, setCurrentId] = useState(TRACKS[1]!.id);
  const [playing, setPlaying] = useState(false);
  const [progressSec, setProgressSec] = useState(84); // 1:24 из 3:45
  const [volume, setVolume] = useState(72);
  const [speed, setSpeed] = useState(1);

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

  return (
    <section
      aria-label="Аудио"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={AudioWaveform}
        title="Аудио"
        description="Озвучка, музыка и подкасты голосами студии"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button size="sm">
          <Plus className="size-4" aria-hidden="true" />
          Новая дорожка
        </Button>
      </ModuleHeader>

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 sm:p-6">
        <GenerationPanel />
        <WipBanner
          title="Визуальный макет"
          description="Реальное синтезирование речи, музыки и шумов подключается на следующем этапе."
          features={["Голоса студии", "Генеративная музыка", "Экспорт в MP3"]}
        />
        <TrackLibrary
          tracks={tracks}
          currentId={currentId}
          playing={playing}
          onTogglePlay={togglePlay}
          onSelect={selectTrack}
        />
      </main>

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
    </section>
  );
}
