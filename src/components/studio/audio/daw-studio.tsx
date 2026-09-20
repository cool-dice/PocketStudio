"use client";

/**
 * DawStudio — вкладка «Студия»: настоящая DAW на Web Audio API.
 *
 * Состояние — DawProject воркспейса (api.getDawState/saveDawState) с
 * автосохранением (debounce 900 мс, индикатор в транспорте). Звук —
 * daw-engine (lookahead-планировщик + оффлайн-рендер микса в WAV).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";

import {
  TRACK_KIND_LABELS,
  dawHasAudibleContent,
  EMPTY_DAW_EXPORT_ERROR,
  stepCount,
  type DawProjectDto,
  type DawState,
  type DawTrack,
  type DrumInstrument,
  type TrackKind,
  type VoiceClip,
} from "@/lib/daw-model";
import {
  DAW_EMPTY_TRACKS,
  DAW_EMPTY_TRACKS_HINT,
  DAW_LOAD_ERROR,
} from "@/lib/audio-copy";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { createDawEngine, renderDawToWav, type DawEngine } from "./daw-engine";
import { DawTrackCard, KIND_META } from "./daw-track-card";
import { DawTransport, type SaveStatus } from "./daw-transport";

const TRACK_KINDS: readonly TrackKind[] = ["drums", "bass", "lead", "pad", "voice"];

function stateFromDto(dto: DawProjectDto): DawState {
  return {
    bpm: dto.bpm,
    bars: dto.bars,
    masterVolume: dto.masterVolume,
    transpose: dto.transpose,
    metronome: dto.metronome,
    tracks: dto.tracks,
  };
}

function makeTrack(kind: TrackKind, bars: number): DawTrack {
  const steps = stepCount(bars);
  const track: DawTrack = {
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: TRACK_KIND_LABELS[kind],
    kind,
    volume: 0.8,
    pan: 0,
    muted: false,
  };
  if (kind === "drums") {
    const empty = (): boolean[] => Array.from({ length: steps }, () => false);
    track.drums = { kick: empty(), snare: empty(), hihat: empty(), clap: empty(), tom: empty() };
  } else if (kind !== "voice") {
    track.waveform = "sawtooth";
    track.octave = kind === "bass" ? 2 : 4;
    track.notes = [];
  }
  return track;
}

/** Смена числа тактов: паттерны/ноты/клипы пересобираются под новую сетку. */
function withBars(state: DawState, bars: number): DawState {
  const steps = stepCount(bars);
  const pad = (row: boolean[]): boolean[] =>
    Array.from({ length: steps }, (_, i) => row[i] === true);
  return {
    ...state,
    bars,
    tracks: state.tracks.map((track) => {
      if (track.kind === "drums" && track.drums) {
        return {
          ...track,
          drums: {
            kick: pad(track.drums.kick),
            snare: pad(track.drums.snare),
            hihat: pad(track.drums.hihat),
            clap: pad(track.drums.clap),
            tom: pad(track.drums.tom),
          },
        };
      }
      if (track.notes) {
        return { ...track, notes: track.notes.filter((n) => n.step < steps) };
      }
      if (track.voice && track.voice.step >= steps) {
        return { ...track, voice: { ...track.voice, step: Math.max(0, steps - 1) } };
      }
      return track;
    }),
  };
}

export function DawStudio({
  projectId,
  onMixed,
}: {
  projectId: string;
  /** Микс загружен в библиотеку — перезагрузить список аудио. */
  onMixed?: () => void;
}) {
  const [state, setState] = useState<DawState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const savedRef = useRef("");
  const engineRef = useRef<DawEngine | null>(null);
  const bufferCacheRef = useRef(new Map<string, { url: string; buffer: AudioBuffer }>());

  const ensureEngine = useCallback((): DawEngine => {
    if (!engineRef.current) {
      const engine = createDawEngine();
      engine.onStep((step) => setCurrentStep(step));
      engineRef.current = engine;
    }
    return engineRef.current;
  }, []);

  /* Остановка на размонтировании. */
  useEffect(
    () => () => {
      engineRef.current?.stop();
      engineRef.current = null;
    },
    [],
  );

  /* Загрузка проекта воркспейса (или повтор по кнопке). */
  useEffect(() => {
    let cancelled = false;
    engineRef.current?.stop();
    setPlaying(false);
    setCurrentStep(-1);
    setLoading(true);
    bufferCacheRef.current.clear();
    api
      .getDawState(projectId)
      .then((dto) => {
        if (cancelled) return;
        const next = stateFromDto(dto);
        setState(next);
        savedRef.current = JSON.stringify(next);
        setSaveStatus("saved");
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : DAW_LOAD_ERROR);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, reloadKey]);

  /* Автосохранение: снапшот → debounce 900 мс → PUT. */
  useEffect(() => {
    if (!state) return;
    const snapshot = JSON.stringify(state);
    if (snapshot === savedRef.current) return;
    setSaveStatus("saving");
    const timer = setTimeout(() => {
      api
        .saveDawState(projectId, state)
        .then(() => {
          savedRef.current = snapshot;
          setSaveStatus("saved");
        })
        .catch(() => setSaveStatus("error"));
    }, 900);
    return () => clearTimeout(timer);
  }, [state, projectId]);

  /* Мастер-громкость — живьём, без перезапуска. */
  const masterVolume = state?.masterVolume;
  useEffect(() => {
    if (masterVolume === undefined) return;
    engineRef.current?.setMasterVolume(masterVolume);
  }, [masterVolume]);

  const patch = useCallback((updater: (prev: DawState) => DawState) => {
    setState((prev) => (prev ? updater(prev) : prev));
  }, []);

  const patchTrack = useCallback(
    (trackId: string, updater: (track: DawTrack) => DawTrack) => {
      patch((prev) => ({
        ...prev,
        tracks: prev.tracks.map((t) => (t.id === trackId ? updater(t) : t)),
      }));
    },
    [patch],
  );

  const stopPlayback = useCallback(() => {
    engineRef.current?.stop();
    setPlaying(false);
    setCurrentStep(-1);
  }, []);

  /* Буферы озвучек голосовых дорожек (кэш по trackId + url). */
  const loadVoiceBuffers = useCallback(
    async (target: DawState): Promise<Map<string, AudioBuffer>> => {
      const map = new Map<string, AudioBuffer>();
      const engine = ensureEngine();
      for (const track of target.tracks) {
        if (track.kind !== "voice" || !track.voice) continue;
        const cached = bufferCacheRef.current.get(track.id);
        if (cached && cached.url === track.voice.artifactUrl) {
          map.set(track.id, cached.buffer);
          continue;
        }
        try {
          const res = await fetch(track.voice.artifactUrl);
          if (!res.ok) continue;
          const data = await res.arrayBuffer();
          const buffer = await engine.ctx.decodeAudioData(data);
          bufferCacheRef.current.set(track.id, { url: track.voice.artifactUrl, buffer });
          map.set(track.id, buffer);
        } catch {
          // Буфера нет — дорожка тихо пропускается.
        }
      }
      return map;
    },
    [ensureEngine],
  );

  const startPlayback = useCallback(async () => {
    if (!state) return;
    const engine = ensureEngine();
    const buffers = await loadVoiceBuffers(state);
    engine.play(state, buffers);
    setPlaying(true);
  }, [state, ensureEngine, loadVoiceBuffers]);

  const exportMix = useCallback(async () => {
    if (!state || exporting) return;
    if (!dawHasAudibleContent(state)) {
      toast.message(EMPTY_DAW_EXPORT_ERROR);
      return;
    }
    setExporting(true);
    try {
      const buffers = await loadVoiceBuffers(state);
      const blob = await renderDawToWav(state, buffers);
      const artifact = await api.uploadArtifact(projectId, {
        blob,
        type: "audio",
        title: `Микс · ${new Date().toLocaleDateString("ru-RU")}`,
        stage: "Сведение",
        meta: { kind: "daw-mix", bpm: state.bpm, bars: state.bars },
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `mix-${Date.now()}.wav`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1_000);
      toast.success("Микс скачан и в библиотеке", {
        description: `«${artifact.title}» — WAV ушёл в загрузки, копия лежит во вкладке «Библиотека».`,
      });
      onMixed?.();
    } catch (err) {
      toast.error("Не удалось собрать микс", {
        description: err instanceof ApiError ? err.message : "Попробуйте ещё раз",
      });
    } finally {
      setExporting(false);
    }
  }, [state, exporting, projectId, loadVoiceBuffers, onMixed]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-label="Загружаем студию">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl opacity-60" />
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
        <CircleAlert className="mx-auto size-6 text-destructive" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium text-destructive">
          {error ?? DAW_LOAD_ERROR}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          <RotateCw className="size-4" aria-hidden="true" />
          Попробовать снова
        </Button>
      </div>
    );
  }

  const totalSteps = stepCount(state.bars);
  const displayStep = currentStep >= 0 ? currentStep : 0;

  return (
    <div className="flex min-w-0 flex-col gap-3" aria-label="DAW-студия">
      <DawTransport
        playing={playing}
        saveStatus={saveStatus}
        exporting={exporting}
        canExport={dawHasAudibleContent(state)}
        position={{
          bar: Math.floor(displayStep / 16) + 1,
          beat: Math.floor((displayStep % 16) / 4) + 1,
          step: displayStep,
          total: totalSteps,
        }}
        bpm={state.bpm}
        bars={state.bars}
        transpose={state.transpose}
        metronome={state.metronome}
        masterVolume={state.masterVolume}
        onTogglePlay={() => (playing ? stopPlayback() : void startPlayback())}
        onBpmStep={(delta) =>
          patch((s) => ({ ...s, bpm: Math.min(220, Math.max(40, s.bpm + delta)) }))
        }
        onBarsChange={(bars) => {
          stopPlayback();
          patch((s) => withBars(s, bars));
        }}
        onTransposeChange={(transpose) => patch((s) => ({ ...s, transpose }))}
        onMetronomeChange={(metronome) => patch((s) => ({ ...s, metronome }))}
        onMasterVolumeChange={(masterVolume) => patch((s) => ({ ...s, masterVolume }))}
        onExport={() => void exportMix()}
      />

      {state.tracks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="text-sm font-medium">{DAW_EMPTY_TRACKS}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {DAW_EMPTY_TRACKS_HINT}
          </p>
        </div>
      ) : (
        state.tracks.map((track) => (
          <DawTrackCard
            key={track.id}
            track={track}
            projectId={projectId}
            totalSteps={totalSteps}
            currentStep={playing ? currentStep : -1}
            onPatch={(p) => patchTrack(track.id, (t) => ({ ...t, ...p }))}
            onToggleDrum={(instrument: DrumInstrument, step) =>
              patchTrack(track.id, (t) => {
                if (!t.drums) return t;
                const row = [...t.drums[instrument]];
                row[step] = !row[step];
                return { ...t, drums: { ...t.drums, [instrument]: row } };
              })
            }
            onToggleNote={(step, midi) =>
              patchTrack(track.id, (t) => {
                if (!t.notes) return t;
                const exists = t.notes.some((n) => n.step === step && n.midi === midi);
                const notes = exists
                  ? t.notes.filter((n) => !(n.step === step && n.midi === midi))
                  : [...t.notes, { step, midi }].sort((a, b) => a.step - b.step);
                return { ...t, notes };
              })
            }
            onVoiceChange={(clip: VoiceClip | undefined) =>
              patchTrack(track.id, (t) => ({ ...t, voice: clip }))
            }
            onRemove={() =>
              patch((s) => ({ ...s, tracks: s.tracks.filter((t) => t.id !== track.id) }))
            }
          />
        ))
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="self-start">
            <Plus className="size-4" aria-hidden="true" />
            Дорожка
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {TRACK_KINDS.map((kind) => {
            const meta = KIND_META[kind];
            return (
              <DropdownMenuItem
                key={kind}
                onClick={() =>
                  patch((s) => ({ ...s, tracks: [...s.tracks, makeTrack(kind, s.bars)] }))
                }
              >
                <meta.icon className="size-4" aria-hidden="true" />
                {TRACK_KIND_LABELS[kind]}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
