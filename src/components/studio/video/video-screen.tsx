"use client";

/**
 * Видео — карманная киностудия (флагманский модуль).
 * Два режима: «Продакшн» (пайплайн, превью, раскадровка, сценарий)
 * и «Монтаж» — NLE-монтажный стол (Premiere/Vegas-lite, вкладка PS-2).
 * Генерация подключается позже.
 */

import { useState } from "react";

import {
  ChevronDown,
  Clapperboard,
  Film,
  Languages,
  MonitorPlay,
  Plus,
  Scissors,
  Timer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ModuleHeader,
  WipBanner,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";

import { EditingTab } from "./editing-tab";
import { PipelineStepper } from "./pipeline-stepper";
import { PreviewPlayer } from "./preview-player";
import { SceneStrip } from "./scene-strip";
import { SidePanel } from "./side-panel";
import { Timeline } from "./timeline";
import {
  ACTIVE_STEP,
  CURRENT_SECONDS,
  FILM_PROJECT,
  PROJECTS,
  SCENES,
  TIMELINE_SCENES,
} from "./video-data";

/** Индекс шага «Монтаж» в конвейере производства. */
const MONTAGE_STEP = 4;

type VideoView = "production" | "editing";

export function VideoScreen({ onOpenMobileNav }: ModuleScreenProps) {
  const [playing, setPlaying] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState(3);
  const [activeStep, setActiveStep] = useState(ACTIVE_STEP);
  const [project, setProject] = useState(PROJECTS[0]);
  const [view, setView] = useState<VideoView>("production");

  const selectedScene =
    SCENES.find((s) => s.id === selectedSceneId) ?? SCENES[2];
  const isFilm = project === FILM_PROJECT;
  const formatBadges = [
    { icon: MonitorPlay, label: "16:9" },
    { icon: Film, label: "1080p" },
    { icon: Timer, label: isFilm ? "14:32" : "~90 сек" },
    { icon: Languages, label: "Русская озвучка" },
  ];

  /** Клик по шагу конвейера: «Монтаж» открывает NLE, остальные — продакшн. */
  const handleStepSelect = (index: number) => {
    setActiveStep(index);
    if (index === MONTAGE_STEP) {
      setView("editing");
      setProject(FILM_PROJECT);
    } else {
      setView("production");
    }
  };

  const handleViewChange = (value: string) => {
    const next = value as VideoView;
    setView(next);
    if (next === "editing") {
      setActiveStep(MONTAGE_STEP);
      setProject(FILM_PROJECT);
    } else if (activeStep === MONTAGE_STEP) {
      setActiveStep(ACTIVE_STEP);
    }
  };

  return (
    <section
      aria-label="Видео"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Clapperboard}
        title="Видео"
        description="Карманная киностудия: сценарий, раскадровка, монтаж"
        stage="wip"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button variant="outline" size="sm">
          <Plus aria-hidden="true" />
          Новый проект
        </Button>
        <Button size="sm">
          <Film aria-hidden="true" />
          Рендер
        </Button>
      </ModuleHeader>

      {/* 1. Проект и формат */}
      <div className="shrink-0 border-b bg-muted/30 px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2">
          <label className="relative flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background pl-3 pr-2 shadow-xs sm:max-w-xs sm:flex-none">
            <Clapperboard
              className="size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <select
              aria-label="Проект"
              value={project}
              onChange={(e) => setProject(e.target.value)}
              className="h-full w-full appearance-none truncate bg-transparent pr-6 text-sm font-medium outline-none"
            >
              {PROJECTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </label>
          <ul
            className="ml-auto flex flex-wrap items-center gap-1.5"
            aria-label="Параметры формата"
          >
            {formatBadges.map((badge) => (
              <li
                key={badge.label}
                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] text-muted-foreground"
              >
                <badge.icon className="size-3.5" aria-hidden="true" />
                {badge.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 2. Конвейер производства */}
      <div className="shrink-0 border-b px-4 py-3 sm:px-6">
        <div className="mx-auto w-full max-w-[1600px]">
          <PipelineStepper selected={activeStep} onSelect={handleStepSelect} />
        </div>
      </div>

      {/* 3. Режимы: Продакшн / Монтаж */}
      <div className="shrink-0 border-b px-4 py-2 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-2">
          <Tabs value={view} onValueChange={handleViewChange}>
            <TabsList className="grid h-9 w-auto grid-cols-2">
              <TabsTrigger value="production">
                <Clapperboard aria-hidden="true" />
                Продакшн
              </TabsTrigger>
              <TabsTrigger value="editing">
                <Scissors aria-hidden="true" />
                Монтаж
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "editing" ? (
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 sm:block">
              NLE · Хроники Долгой Зимы · часть I
            </span>
          ) : null}
        </div>
      </div>

      {/* 4. Контент режима */}
      {view === "production" ? (
        <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-[1600px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="flex min-w-0 flex-col gap-4 p-4 sm:gap-5 sm:p-6">
              <PreviewPlayer
                playing={playing}
                onTogglePlaying={() => setPlaying((p) => !p)}
                scene={selectedScene}
              />
              <Timeline
                scenes={TIMELINE_SCENES}
                selectedSceneId={selectedSceneId}
                onSelectScene={setSelectedSceneId}
                playing={playing}
                currentSeconds={CURRENT_SECONDS}
              />
              <SceneStrip
                selectedSceneId={selectedSceneId}
                onSelectScene={setSelectedSceneId}
              />
            </div>

            <aside className="flex min-w-0 flex-col gap-4 border-t bg-card/50 p-4 sm:gap-5 sm:p-5 lg:border-l lg:border-t-0">
              <SidePanel scene={selectedScene} playing={playing} />
              <div className="shrink-0">
                <WipBanner
                  title="Пока это визуальный макет"
                  description="Рендер и озвучка подключаются к движку генерации"
                  features={[
                    "Текст→видео",
                    "Голосовая озвучка",
                    "Авто-субтитры",
                    "Экспорт MP4",
                  ]}
                />
              </div>
            </aside>
          </div>
        </div>
      ) : (
        <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
          <EditingTab />
        </div>
      )}
    </section>
  );
}
