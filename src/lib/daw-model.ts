/**
 * Общая модель карманной DAW (Фаза C) — используется и API-роутом
 * (валидация/нормализация), и клиентом студии (типы, сид-паттерн).
 *
 * Состояние = один DawProject на воркспейс: bpm, такты, мастер-громкость,
 * транспонирование, метроном и дорожки (JSON). Дорожки трёх семейств:
 *  - drums  — степ-секвенсор: 5 инструментов × N шагов (kick/snare/hihat/clap/tom);
 *  - bass/lead/pad — синт с волной и пик-нотами (midi) на сетке шагов;
 *  - voice  — аудио-артефакт воркспейса (озвучка/загрузка), ставится на шаг.
 */

/* ─────────────────────────── Типы ─────────────────────────── */

export type DrumInstrument = "kick" | "snare" | "hihat" | "clap" | "tom";
export type SynthKind = "bass" | "lead" | "pad";
export type TrackKind = "drums" | SynthKind | "voice";
export type Waveform = "sine" | "square" | "sawtooth" | "triangle";

/** Дорожка-барабаны: строки инструментов × шаги (16-е доли). */
export interface DrumPattern {
  kick: boolean[];
  snare: boolean[];
  hihat: boolean[];
  clap: boolean[];
  tom: boolean[];
}

/** Нота синт-дорожки на сетке: шаг + midi-высота (24..96). */
export interface SynthNote {
  step: number;
  midi: number;
}

/** Голосовая дорожка: аудио-артефакт, поставленный на шаг сетки. */
export interface VoiceClip {
  artifactId: string;
  artifactTitle: string;
  artifactUrl: string;
  step: number;
}

export interface DawTrack {
  id: string;
  name: string;
  kind: TrackKind;
  /** Громкость дорожки 0..1. */
  volume: number;
  /** Панорама -1..1. */
  pan: number;
  muted: boolean;
  /** drums: паттерн инструментов. */
  drums?: DrumPattern;
  /** bass/lead/pad: волна и ноты. */
  waveform?: Waveform;
  octave?: number;
  notes?: SynthNote[];
  /** voice: клип из аудио-артефакта. */
  voice?: VoiceClip;
}

export interface DawState {
  bpm: number;
  bars: number;
  masterVolume: number;
  transpose: number;
  metronome: boolean;
  tracks: DawTrack[];
}

export interface DawProjectDto {
  id: string;
  projectId: string;
  bpm: number;
  bars: number;
  masterVolume: number;
  transpose: number;
  metronome: boolean;
  tracks: DawTrack[];
  updatedAt: string;
}

/* ─────────────────────────── Константы ─────────────────────────── */

export const DRUM_INSTRUMENTS: readonly DrumInstrument[] = [
  "kick",
  "snare",
  "hihat",
  "clap",
  "tom",
] as const;

export const DRUM_LABELS: Record<DrumInstrument, string> = {
  kick: "Бочка",
  snare: "Снейр",
  hihat: "Хэт",
  clap: "Хлопок",
  tom: "Том",
};

export const TRACK_KIND_LABELS: Record<TrackKind, string> = {
  drums: "Барабаны",
  bass: "Бас",
  lead: "Лид",
  pad: "Пэд",
  voice: "Голос",
};

/** Всего шагов сетки (16-е доли): такты × 16. */
export function stepCount(bars: number): number {
  return bars * 16;
}

/** Частота midi-ноты. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const NOTE_NAMES_RU = ["До", "До♯", "Ре", "Ре♯", "Ми", "Фа", "Фа♯", "Соль", "Соль♯", "Ля", "Ля♯", "Си"];

/** «До♯3»-подпись midi-ноты для пиано-ролла. */
export function midiLabel(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12] ?? "C";
  return `${name}${Math.floor(midi / 12) - 1}`;
}

/** Русское имя ноты без октавы. */
export function midiLabelRu(midi: number): string {
  return NOTE_NAMES_RU[((midi % 12) + 12) % 12] ?? "";
}

/* ─────────────────────────── Сид-проект ─────────────────────────── */

function emptySteps(bars: number): boolean[] {
  return Array.from({ length: stepCount(bars) }, () => false);
}

function seedDrumTrack(bars: number): DawTrack {
  const steps = stepCount(bars);
  const kick = emptySteps(bars);
  const snare = emptySteps(bars);
  const hihat = emptySteps(bars);
  const clap = emptySteps(bars);
  for (let i = 0; i < steps; i++) {
    if (i % 4 === 0) kick[i] = true; // четверти
    if (i % 8 === 4) snare[i] = true; // 2 и 4 доли
    if (i % 2 === 0) hihat[i] = true; // восьмые
  }
  if (steps > 15) clap[15] = true;
  return {
    id: `seed-drums`,
    name: "Бит",
    kind: "drums",
    volume: 0.9,
    pan: 0,
    muted: false,
    drums: { kick, snare, hihat, clap, tom: emptySteps(bars) },
  };
}

function seedBassTrack(bars: number): DawTrack {
  const root = 36; // C2
  const riff: Array<[number, number]> = [
    [0, 0], [3, 0], [6, 7], [8, 0], [11, 3], [14, 0],
  ];
  const notes: SynthNote[] = [];
  for (let bar = 0; bar < Math.min(bars, 2); bar++) {
    for (const [step, semitone] of riff) {
      notes.push({ step: bar * 16 + step, midi: root + semitone });
    }
  }
  return {
    id: `seed-bass`,
    name: "Бас",
    kind: "bass",
    volume: 0.75,
    pan: 0,
    muted: false,
    waveform: "sawtooth",
    octave: 2,
    notes,
  };
}

/** Демо-проект: бит + бас — играбельно сразу после открытия студии. */
export function defaultDawState(bars = 4): DawState {
  return {
    bpm: 112,
    bars,
    masterVolume: 0.85,
    transpose: 0,
    metronome: false,
    tracks: [seedDrumTrack(bars), seedBassTrack(bars)],
  };
}

/* ─────────────────────────── Нормализация ─────────────────────────── */

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const WAVEFORMS: readonly Waveform[] = ["sine", "square", "sawtooth", "triangle"];
const KINDS: readonly TrackKind[] = ["drums", "bass", "lead", "pad", "voice"];
const MAX_TRACKS = 16;
const MAX_BARS = 16;

function normBool(value: unknown, steps: number): boolean[] {
  const arr = Array.isArray(value) ? value : [];
  const out = Array.from({ length: steps }, (_, i) => Boolean(arr[i]));
  return out;
}

function normDrums(value: unknown, steps: number): DrumPattern {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    kick: normBool(raw.kick, steps),
    snare: normBool(raw.snare, steps),
    hihat: normBool(raw.hihat, steps),
    clap: normBool(raw.clap, steps),
    tom: normBool(raw.tom, steps),
  };
}

function normNotes(value: unknown, steps: number): SynthNote[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: SynthNote[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const step = Math.round(Number((item as Record<string, unknown>).step));
    const midi = Math.round(Number((item as Record<string, unknown>).midi));
    if (!Number.isFinite(step) || !Number.isFinite(midi)) continue;
    if (step < 0 || step >= steps || midi < 24 || midi > 96) continue;
    const key = `${step}:${midi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ step, midi });
    if (out.length >= 512) break;
  }
  return out.sort((a, b) => a.step - b.step);
}

function normVoice(value: unknown): VoiceClip | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  const artifactId = typeof raw.artifactId === "string" ? raw.artifactId : "";
  const artifactUrl = typeof raw.artifactUrl === "string" ? raw.artifactUrl : "";
  if (!artifactId || !artifactUrl) return undefined;
  const step = Math.max(0, Math.round(Number(raw.step) || 0));
  return {
    artifactId,
    artifactUrl,
    artifactTitle: typeof raw.artifactTitle === "string" ? raw.artifactTitle.slice(0, 160) : "Аудио",
    step,
  };
}

function normTrack(value: unknown, steps: number): DawTrack | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;
  const kind = KINDS.includes(raw.kind as TrackKind) ? (raw.kind as TrackKind) : null;
  if (!kind) return null;
  const track: DawTrack = {
    id: typeof raw.id === "string" && raw.id.length >= 1 && raw.id.length <= 48 ? raw.id : `t${Math.random().toString(36).slice(2, 10)}`,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim().slice(0, 60) : TRACK_KIND_LABELS[kind],
    kind,
    volume: clamp(Number(raw.volume ?? 0.8) || 0.8, 0, 1),
    pan: clamp(Number(raw.pan ?? 0) || 0, -1, 1),
    muted: Boolean(raw.muted),
  };
  if (kind === "drums") {
    track.drums = normDrums(raw.drums, steps);
  } else if (kind === "voice") {
    track.voice = normVoice(raw.voice);
  } else {
    track.waveform = WAVEFORMS.includes(raw.waveform as Waveform) ? (raw.waveform as Waveform) : "sawtooth";
    track.octave = clamp(Math.round(Number(raw.octave ?? 3) || 3), 1, 6);
    track.notes = normNotes(raw.notes, steps);
  }
  return track;
}

/** Нормализовать произвольный JSON к валидному DawState (или null). */
export function normalizeDawState(value: unknown): DawState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  // Без массива tracks мусор вроде `{ bpm: 120 }` не должен затирать дорожки.
  if (!Array.isArray(raw.tracks)) return null;
  const bars = clamp(Math.round(Number(raw.bars) || 4), 1, MAX_BARS);
  const steps = stepCount(bars);
  const tracks: DawTrack[] = [];
  for (const item of raw.tracks) {
    const track = normTrack(item, steps);
    if (track) tracks.push(track);
    if (tracks.length >= MAX_TRACKS) break;
  }
  return {
    bpm: clamp(Math.round(Number(raw.bpm) || 112), 40, 220),
    bars,
    masterVolume: clamp(Number(raw.masterVolume ?? 0.85) || 0.85, 0, 1),
    transpose: clamp(Math.round(Number(raw.transpose) || 0), -12, 12),
    metronome: Boolean(raw.metronome),
    tracks,
  };
}

export const EMPTY_DAW_EXPORT_ERROR =
  "Нечего экспортировать: нет ударов, нот и голосовых клипов. Тихий WAV не собираю.";

/** Есть ли в проекте хоть один слышимый триггер (не пустые дорожки). */
export function dawHasAudibleContent(state: DawState): boolean {
  for (const track of state.tracks) {
    if (track.kind === "drums" && track.drums) {
      for (const inst of DRUM_INSTRUMENTS) {
        if (track.drums[inst]?.some(Boolean)) return true;
      }
    } else if (track.kind === "voice") {
      if (track.voice?.artifactId && track.voice.artifactUrl) return true;
    } else if (track.notes && track.notes.length > 0) {
      return true;
    }
  }
  return false;
}

/** Длительность шага (сек) при BPM. */
export function stepSeconds(bpm: number): number {
  return 60 / bpm / 4;
}
