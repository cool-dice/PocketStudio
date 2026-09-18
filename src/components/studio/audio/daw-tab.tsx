"use client";

import { useEffect, useState } from "react";
import {
  barsPerTick,
  DAW_TRACKS,
  DEFAULT_BEAT,
  DEFAULT_PLAYHEAD,
  INITIAL_CLIPS,
  LOOP_END,
  LOOP_START,
  TOTAL_BARS,
  makeStemClips,
  nextClipId,
  type DawClip,
  type DawTrackId,
  type DawTrackState,
  type SampleItem,
} from "./daw-data";
import { DawTimeline } from "./daw-timeline";
import { MixerSection } from "./mixer-section";
import { SampleBrowser } from "./sample-browser";
import { StepSequencer } from "./step-sequencer";
import { TransportBar } from "./transport-bar";
import type { BeatPreset } from "./daw-data";

/** Источник стемов для «Разложить на дорожки». */
export interface StemSource {
  title: string;
  gradient: string;
}

/** Дорожки, которые замещаются стемами при «Разложить на дорожки». */
const STEM_TRACKS: readonly DawTrackId[] = ["vocal", "beat", "bass", "synth"];

/**
 * Вкладка «Студия» — карманная DAW (FL Studio-lite):
 * транспорт, таймлайн, сэмплы, секвенсор бита и микшер.
 * Чистый визуальный макет: локальный state, интервал плейхеда.
 */
export function DawTab({ stemSource }: { stemSource: StemSource | null }) {
  /* Транспорт */
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(DEFAULT_PLAYHEAD);
  const [bpm, setBpm] = useState(120);
  const [metronome, setMetronome] = useState(true);
  const [masterVolume, setMasterVolume] = useState(82);
  const [loop, setLoop] = useState(false);

  /* Проект */
  const [tracks, setTracks] = useState<DawTrackState[]>(DAW_TRACKS);
  const [clips, setClips] = useState<DawClip[]>(INITIAL_CLIPS);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [mixerOpen, setMixerOpen] = useState(false);

  /* Секвенсор бита */
  const [beat, setBeat] = useState<boolean[][]>(DEFAULT_BEAT);
  const [activePresetId, setActivePresetId] = useState<string | null>("basic");

  /* ——— Плейхед: setInterval + CSS-переход для плавности ——— */
  useEffect(() => {
    if (!playing) return;
    const step = barsPerTick(bpm);
    const id = setInterval(() => {
      setPlayhead((p) => {
        const next = p + step;
        if (loop && next >= LOOP_END) return LOOP_START;
        if (next >= TOTAL_BARS) return 0;
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, bpm, loop]);

  /* ——— «Разложить на дорожки»: стемы прилетают из библиотеки ———
     Паттерн «корректировка state при смене пропса» (без эффекта).
     Стемы замещают клипы своих дорожек (Вокал/Бит/Бас/Синт),
     чтобы не перекрывать их на таймлайне. */
  const [appliedStem, setAppliedStem] = useState<StemSource | null>(null);
  if (stemSource !== appliedStem) {
    setAppliedStem(stemSource);
    if (stemSource) {
      setClips((prev) => [
        ...prev.filter((c) => !c.fromStems && !STEM_TRACKS.includes(c.trackId)),
        ...makeStemClips(stemSource.title),
      ]);
      setSelectedClipId(null);
    }
  }

  /* ——— Операции над дорожками ——— */
  const updateTrack = (id: DawTrackId, patch: Partial<DawTrackState>) =>
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const toggleMute = (id: DawTrackId) => {
    const t = tracks.find((x) => x.id === id);
    if (t) updateTrack(id, { muted: !t.muted });
  };
  const toggleSolo = (id: DawTrackId) => {
    const t = tracks.find((x) => x.id === id);
    if (t) updateTrack(id, { solo: !t.solo });
  };
  const stepTranspose = (id: DawTrackId, delta: number) => {
    const t = tracks.find((x) => x.id === id);
    if (!t) return;
    updateTrack(id, { transpose: Math.max(-12, Math.min(12, t.transpose + delta)) });
  };

  /* ——— Операции над клипами ——— */
  const duplicateClip = (id: string) => {
    const src = clips.find((c) => c.id === id);
    if (!src) return;
    const copyId = nextClipId();
    const copy: DawClip = {
      ...src,
      id: copyId,
      startBar: Math.min(Math.max(0, TOTAL_BARS - src.lengthBars), src.startBar + src.lengthBars),
    };
    setClips((prev) => [...prev, copy]);
    setSelectedClipId(copyId);
  };

  const transposeClip = (id: string, delta: number) =>
    setClips((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, transpose: Math.max(-12, Math.min(12, c.transpose + delta)) } : c,
      ),
    );

  const deleteClip = (id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setSelectedClipId((cur) => (cur === id ? null : cur));
  };

  /* ——— Сэмпл → дорожка «Сэмпл» ——— */
  const addSampleToTimeline = (sample: SampleItem) => {
    const id = nextClipId();
    const occupied = clips.filter((c) => c.trackId === "sample");
    const end = occupied.length
      ? Math.max(...occupied.map((c) => c.startBar + c.lengthBars))
      : 0;
    const clip: DawClip = {
      id,
      trackId: "sample",
      name: sample.name,
      startBar: Math.min(Math.max(0, TOTAL_BARS - sample.lengthBars), end),
      lengthBars: sample.lengthBars,
      key: sample.key,
      bpm: sample.bpm,
      transpose: 0,
      wave: sample.wave,
    };
    setClips((prev) => [...prev, clip]);
    setSelectedClipId(id);
  };

  /* ——— Секвенсор ——— */
  const toggleCell = (row: number, step: number) =>
    setBeat((prev) => prev.map((r, ri) => (ri === row ? r.map((on, si) => (si === step ? !on : on)) : r)));

  const loadPreset = (preset: BeatPreset) => {
    setBeat(preset.steps);
    setActivePresetId(preset.id);
  };

  const stop = () => {
    setPlaying(false);
    setPlayhead(DEFAULT_PLAYHEAD);
  };

  /* Микшер: тоггл из транспорта/секции + прокрутка к стрипам при открытии. */
  const toggleMixer = () => {
    const next = !mixerOpen;
    setMixerOpen(next);
    if (next) {
      window.setTimeout(
        () => document.getElementById("daw-mixer")?.scrollIntoView({ behavior: "smooth", block: "end" }),
        60,
      );
    }
  };

  const activeStep = playing ? Math.floor((playhead % 1) * 16) : -1;

  return (
    <div className="vf-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
      <TransportBar
        playing={playing}
        playhead={playhead}
        bpm={bpm}
        metronome={metronome}
        masterVolume={masterVolume}
        mixerOpen={mixerOpen}
        onTogglePlay={() => setPlaying((p) => !p)}
        onStop={stop}
        onBpmChange={setBpm}
        onMetronomeChange={setMetronome}
        onMasterVolumeChange={setMasterVolume}
        onToggleMixer={toggleMixer}
      />

      {/* Библиотека сэмплов слева, таймлайн + секвенсор в центре на lg.
          Мин-высота ряда не даёт сплющить таймлайн при открытом микшере —
          вся студия мягко прокручивается вертикально. */}
      <div className="flex flex-1 flex-col-reverse gap-3 lg:min-h-[29rem] lg:flex-row">
        <aside
          aria-label="Библиотека сэмплов"
          className="flex w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:w-80"
        >
          <SampleBrowser onAddToTrack={addSampleToTimeline} />
        </aside>

        <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1">
          <DawTimeline
            tracks={tracks}
            clips={clips}
            selectedClipId={selectedClipId}
            playhead={playhead}
            playing={playing}
            loopEnabled={loop}
            stemTitle={stemSource?.title ?? null}
            onToggleLoop={() => setLoop((l) => !l)}
            onToggleMute={toggleMute}
            onToggleSolo={toggleSolo}
            onVolumeChange={(id, v) => updateTrack(id, { volume: v })}
            onStepTranspose={stepTranspose}
            onSelectClip={setSelectedClipId}
            onDuplicateClip={duplicateClip}
            onTransposeClip={transposeClip}
            onDeleteClip={deleteClip}
          />
          <StepSequencer
            pattern={beat}
            activeStep={activeStep}
            playing={playing}
            activePresetId={activePresetId}
            onTogglePlay={() => setPlaying((p) => !p)}
            onStop={stop}
            onToggleCell={toggleCell}
            onLoadPreset={loadPreset}
          />
        </div>
      </div>

      <MixerSection
        open={mixerOpen}
        onOpenChange={setMixerOpen}
        tracks={tracks}
        masterVolume={masterVolume}
        onVolumeChange={(id, v) => updateTrack(id, { volume: v })}
        onPanChange={(id, v) => updateTrack(id, { pan: v })}
        onToggleMute={toggleMute}
        onToggleSolo={toggleSolo}
        onMasterVolumeChange={setMasterVolume}
      />
    </div>
  );
}
