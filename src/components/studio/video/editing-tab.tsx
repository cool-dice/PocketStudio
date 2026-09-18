"use client";

/**
 * Вкладка «Монтаж» (NLE): медиатека слева, программный монитор +
 * мультитрековый таймлайн + мини-микшер в центре, инспектор клипа
 * справа. Всё состояние локальное (useNleProject), бэкенда нет.
 */

import { useCallback, useEffect, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { WipBanner } from "@/components/studio/shared/module-header";
import { cn } from "@/lib/utils";

import { AssembleDialog, FilmPreviewDialog } from "./assemble-dialog";
import { ClipInspector } from "./clip-inspector";
import { MediaLibrary } from "./media-library";
import { NleTimeline } from "./nle-timeline";
import { NleToolbar } from "./nle-toolbar";
import { ProgramMonitor } from "./program-monitor";
import { useNleProject, type TrackRuntime } from "./use-nle-project";
import {
  FILM_SECONDS,
  PPS_LEVELS,
  TRACKS,
  TRACK_BY_ID,
  type MediaItem,
  type TrackId,
} from "./nle-data";

/* ── Мини-микшер ────────────────────────────────────────────────────── */

function MiniMixer({
  trackState,
  onVolume,
  open,
  onToggle,
}: {
  trackState: Record<TrackId, TrackRuntime>;
  onVolume: (id: TrackId, volume: number) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section aria-label="Мини-микшер" className="rounded-xl border bg-card p-3 sm:p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <SlidersHorizontal className="size-3.5 text-primary" aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Мини-микшер
        </h3>
        <span className="rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
          громкость дорожек
        </span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
          {TRACKS.map((track) => {
            const runtime = trackState[track.id];
            const Icon = track.icon;
            return (
              <div key={track.id} className="rounded-lg border bg-background/50 p-2">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <Icon className="size-3 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 truncate text-[10px] font-medium">
                    {track.label}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {runtime.muted ? "—" : `${runtime.volume}%`}
                  </span>
                </div>
                <Slider
                  value={[runtime.volume]}
                  onValueChange={(v) => onVolume(track.id, v[0] ?? 0)}
                  disabled={runtime.muted}
                  aria-label={`Громкость ${track.label}`}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

/* ── Вкладка ────────────────────────────────────────────────────────── */

export function EditingTab() {
  const nle = useNleProject();
  const [safeZones, setSafeZones] = useState(false);
  const [assembled, setAssembled] = useState(false);
  const [assembleOpen, setAssembleOpen] = useState(false);
  const [assembleRun, setAssembleRun] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(true);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const showToast = useCallback((text: string) => {
    setToast({ id: Date.now(), text });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleDelete = useCallback(() => {
    if (!nle.selectedClip) return;
    if (!nle.removeSelected()) {
      showToast("Дорожка заблокирована — снимите замок");
      return;
    }
    showToast("Клип удалён с дорожки");
  }, [nle, showToast]);

  /* Delete удаляет выбранный клип (когда фокус не в поле ввода) */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      )
        return;
      if (!nle.selectedClip) return;
      e.preventDefault();
      handleDelete();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nle.selectedClip, handleDelete]);

  const handleSplit = useCallback(
    (id: string, ratio: number) => {
      const ok = nle.splitClip(id, ratio);
      showToast(ok ? "Клип разделён бритвой" : "Дорожка заблокирована — снимите замок");
      return ok;
    },
    [nle, showToast],
  );

  const handleAdd = useCallback(
    (item: MediaItem) => {
      const trackId = nle.addMediaClip(item);
      showToast(
        trackId
          ? `«${item.name}» → ${TRACK_BY_ID[trackId].label}`
          : "Дорожка заблокирована — снимите замок",
      );
    },
    [nle, showToast],
  );

  const openAssemble = useCallback(() => {
    setAssembleRun((r) => r + 1);
    setAssembleOpen(true);
  }, []);

  const pps = PPS_LEVELS[nle.zoom];

  return (
    <div className="mx-auto w-full max-w-[1600px]">
      {/* На очень широких экранах (≥1760px) включаем трёхколоночную сетку.
          Tailwind v4 сортирует произвольные варианты (min-[…]) ДО именованных
          брейкпоинтов (lg:), поэтому lg-утилита перебила бы min-[1760px]: —
          переопределяем через локальный style-блок позже по каскаду. */}
      <style>{`
        @media (min-width: 1760px) {
          .ps2d-nle-grid { grid-template-columns: 288px minmax(0, 1fr) 324px; }
          .ps2d-nle-grid > .ps2d-nle-inspector { grid-column: auto; }
          .ps2d-nle-inspector-card { display: flex; flex-direction: column; }
        }
      `}</style>
      <div className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-6">
        <NleToolbar
          filmSeconds={FILM_SECONDS}
          assembled={assembled}
          onAssemble={openAssemble}
          snapping={nle.snapping}
          onSnappingChange={nle.setSnapping}
          zoom={nle.zoom}
          onZoomChange={nle.setZoom}
        />

        <div className="ps2d-nle-grid grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[264px_minmax(0,1fr)] lg:items-start">
          {/* Центр: монитор + таймлайн + микшер */}
          <section
            aria-label="Монтаж: монитор и таймлайн"
            className="order-1 flex min-w-0 flex-col gap-4 sm:gap-5 lg:order-2"
          >
            <ProgramMonitor
              frameClip={nle.frameClip}
              overlayTitle={nle.overlayTitle}
              selectedClip={nle.selectedClip}
              playhead={nle.playhead}
              playing={nle.playing}
              timelineEnd={nle.timelineEnd}
              safeZones={safeZones}
              onToggleSafeZones={setSafeZones}
              onTogglePlaying={nle.togglePlaying}
              onSeek={nle.seekTo}
              onSkipToStart={nle.skipToStart}
              onSkipToEnd={nle.skipToEnd}
            />
            <NleTimeline
              clips={nle.clips}
              clipsByTrack={nle.clipsByTrack}
              trackState={nle.trackState}
              selectedId={nle.selectedId}
              tool={nle.tool}
              snapping={nle.snapping}
              pps={pps}
              playhead={nle.playhead}
              playing={nle.playing}
              timelineEnd={nle.timelineEnd}
              onToolChange={nle.setTool}
              onSelect={nle.selectClip}
              onSplit={handleSplit}
              onDeleteSelected={handleDelete}
              onSeek={nle.seekTo}
              onToggleTrackFlag={nle.toggleTrackFlag}
              onTrackVolume={nle.setTrackVolume}
              onBlocked={() => showToast("Дорожка заблокирована — снимите замок")}
            />
            <MiniMixer
              trackState={nle.trackState}
              onVolume={nle.setTrackVolume}
              open={mixerOpen}
              onToggle={() => setMixerOpen((o) => !o)}
            />
          </section>

          {/* Слева: медиатека */}
          <aside aria-label="Медиатека проекта" className="order-2 min-w-0 lg:order-1">
            <MediaLibrary
              onAdd={handleAdd}
              onGenerate={() =>
                showToast("Генерация сцен подключается на следующем этапе")
              }
            />
          </aside>

          {/* Справа: инспектор (до 1760px — широкая строка под столом, выше — правая колонка) */}
          <aside
            aria-label="Инспектор"
            className="ps2d-nle-inspector order-3 flex min-w-0 flex-col gap-4 lg:col-span-2"
          >
            <ClipInspector
              clip={nle.selectedClip}
              onSpeed={nle.setSpeed}
              onLut={nle.setLut}
              onTransition={nle.setTransition}
              onTitleText={nle.setTitleText}
              onTitleProps={nle.setTitleProps}
              onRemove={handleDelete}
            />
            <WipBanner
              title="Монтаж — визуальный макет"
              description="Склейка, бритва и эффекты живут прямо в браузере; рендер и экспорт подключаются к движку"
              features={["Экспорт MP4", "Авто-субтитры", "Публикация"]}
            />
          </aside>
        </div>
      </div>

      {/* Диалоги */}
      <AssembleDialog
        key={assembleRun}
        open={assembleOpen}
        onOpenChange={setAssembleOpen}
        onFinished={() => setAssembled(true)}
        onPreview={() => setPreviewOpen(true)}
      />
      <FilmPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} />

      {/* Тост */}
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            role="status"
            className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border bg-popover/95 px-4 py-2 text-xs font-medium text-popover-foreground shadow-lg backdrop-blur"
          >
            <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            {toast.text}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
