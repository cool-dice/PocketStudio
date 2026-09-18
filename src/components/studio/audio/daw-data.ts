/**
 * Мок-данные DAW-студии (вкладка «Студия» модуля «Аудио»).
 * Чистый визуальный макет: типы + предзаполненный проект.
 */

import type { LucideIcon } from "lucide-react";
import { AudioLines, CircleDot, Disc3, Drum, Mic, Piano } from "lucide-react";

/* ——— Константы проекта ——— */

export const TOTAL_BARS = 16;
/** Регион зацикливания на линейке (в тактах, 0-индексация). */
export const LOOP_START = 4;
export const LOOP_END = 8;
/** Стартовая позиция плейхеда — «Такт 5.2». */
export const DEFAULT_PLAYHEAD = 4.25;
/** Период тика плейхеда; плавность даёт CSS transition. */
export const TICK_MS = 100;

/** Тактов за один тик при данном BPM (4/4). */
export function barsPerTick(bpm: number): number {
  return ((bpm / 60) / 4) * (TICK_MS / 1000);
}

/* ——— Типы ——— */

export type DawTrackId = "vocal" | "beat" | "bass" | "synth" | "sample" | "record";

export interface DawTrackState {
  id: DawTrackId;
  name: string;
  icon: LucideIcon;
  /** Основной цвет дорожки (hex). */
  color: string;
  /** Мягкая заливка клипа (hex8 с альфой). */
  colorSoft: string;
  /** Цвет границы клипа (hex8). */
  colorBorder: string;
  volume: number; // 0–100
  pan: number; // −100…100
  muted: boolean;
  solo: boolean;
  transpose: number; // −12…+12 полутонов
  /** Кривая EQ: 6 точек, дБ −12…+12. */
  eq: number[];
}

export interface DawClip {
  id: string;
  trackId: DawTrackId;
  name: string;
  startBar: number;
  lengthBars: number;
  key: string;
  bpm: number;
  transpose: number;
  /** Клип получен «Разложить на дорожки» (стем). */
  fromStems?: boolean;
  wave: number[];
}

export type SampleGenre = "lo-fi" | "synthwave" | "оркестр" | "эмбиент";
export type SampleType = "барабаны" | "бас" | "пад" | "вокал" | "FX";
export type SampleBpmRange = "60–90" | "90–120" | "120+";

export interface SampleItem {
  id: string;
  name: string;
  genre: SampleGenre;
  type: SampleType;
  bpm: number;
  key: string;
  lengthBars: number;
  gradient: string;
  wave: number[];
  createdAtMs: number;
  /** Сэмпл загружен пользователем (а не из библиотеки). */
  uploaded?: boolean;
  /** Только что сгенерирован ИИ — подсветка «Новое». */
  fresh?: boolean;
}

export interface BeatPreset {
  id: string;
  name: string;
  steps: boolean[][];
}

/* ——— Утилиты ——— */

/** Детерминированная волна (Park–Miller + синус-огибающая). */
export function makeWave(seed: number, n = 28): number[] {
  const out: number[] = [];
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  for (let i = 0; i < n; i++) {
    x = (x * 16807) % 2147483647;
    const env = 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / n);
    out.push(Math.max(12, Math.round(18 + (x / 2147483647) * 82 * env)));
  }
  return out;
}

const NOW = 1_780_000_000_000; // фиксированное «сегодня» для сортировки по дате
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/* ——— Дорожки проекта ——— */

export const DAW_TRACKS: DawTrackState[] = [
  {
    id: "vocal", name: "Вокал", icon: Mic,
    color: "#34d399", colorSoft: "#34d39926", colorBorder: "#34d39959",
    volume: 78, pan: -12, muted: false, solo: false, transpose: 0,
    eq: [4, 2, -1, 0, 3, 1],
  },
  {
    id: "beat", name: "Бит", icon: Drum,
    color: "#fbbf24", colorSoft: "#fbbf2426", colorBorder: "#fbbf2459",
    volume: 88, pan: 0, muted: false, solo: false, transpose: 0,
    eq: [5, 3, 0, -3, 2, 1],
  },
  {
    id: "bass", name: "Бас", icon: AudioLines,
    color: "#2dd4bf", colorSoft: "#2dd4bf26", colorBorder: "#2dd4bf59",
    volume: 82, pan: 8, muted: false, solo: false, transpose: -12,
    eq: [6, 4, 0, -2, -1, -2],
  },
  {
    id: "synth", name: "Синт", icon: Piano,
    color: "#fb7185", colorSoft: "#fb718526", colorBorder: "#fb718559",
    volume: 68, pan: -22, muted: false, solo: false, transpose: 0,
    eq: [1, 0, 2, 4, 5, 3],
  },
  {
    id: "sample", name: "Сэмпл", icon: Disc3,
    color: "#a8a29e", colorSoft: "#a8a29e2e", colorBorder: "#a8a29e59",
    volume: 74, pan: 30, muted: false, solo: false, transpose: 0,
    eq: [0, 1, 1, 2, 2, 2],
  },
  {
    id: "record", name: "Запись", icon: CircleDot,
    color: "#a3e635", colorSoft: "#a3e63524", colorBorder: "#a3e63559",
    volume: 70, pan: 0, muted: false, solo: false, transpose: 0,
    eq: [0, 0, 0, 0, 0, 0],
  },
];

export const MASTER_EQ = [2, 1, 0, 0, 1, 2];

/* ——— Клипы стартового проекта ——— */

export const INITIAL_CLIPS: DawClip[] = [
  { id: "clip-v1", trackId: "vocal", name: "Ари — вокал дубль 2", startBar: 2, lengthBars: 6, key: "Am", bpm: 120, transpose: 0, wave: makeWave(101) },
  { id: "clip-v2", trackId: "vocal", name: "бэк-вокал · припев", startBar: 10, lengthBars: 4, key: "Am", bpm: 120, transpose: 0, wave: makeWave(211) },
  { id: "clip-b1", trackId: "beat", name: "кик-паттерн-A", startBar: 0, lengthBars: 8, key: "—", bpm: 120, transpose: 0, wave: makeWave(307) },
  { id: "clip-b2", trackId: "beat", name: "снейр-заливка", startBar: 8, lengthBars: 2, key: "—", bpm: 120, transpose: 0, wave: makeWave(409) },
  { id: "clip-b3", trackId: "beat", name: "перкуссия · мост", startBar: 11, lengthBars: 3, key: "—", bpm: 120, transpose: 0, wave: makeWave(503) },
  { id: "clip-s1", trackId: "bass", name: "бас-линия", startBar: 0, lengthBars: 8, key: "Am", bpm: 120, transpose: -12, wave: makeWave(601) },
  { id: "clip-s2", trackId: "bass", name: "саб-дроп · финал", startBar: 12, lengthBars: 4, key: "Am", bpm: 120, transpose: 0, wave: makeWave(701) },
  { id: "clip-y1", trackId: "synth", name: "пад «ночной город»", startBar: 4, lengthBars: 8, key: "F#m", bpm: 120, transpose: 0, wave: makeWave(809) },
  { id: "clip-y2", trackId: "synth", name: "арпеджио-луп", startBar: 12, lengthBars: 3, key: "Am", bpm: 120, transpose: 0, wave: makeWave(907) },
  { id: "clip-p1", trackId: "sample", name: "винил-шум 78 об.", startBar: 0, lengthBars: 4, key: "—", bpm: 120, transpose: 0, wave: makeWave(1009) },
  { id: "clip-p2", trackId: "sample", name: "уличный фон", startBar: 8, lengthBars: 4, key: "—", bpm: 120, transpose: 0, wave: makeWave(1103) },
];

/** Клипы-стемы после «Разложить на дорожки». */
export function makeStemClips(sourceTitle: string): DawClip[] {
  const short = sourceTitle.length > 20 ? `${sourceTitle.slice(0, 19)}…` : sourceTitle;
  return [
    { id: `stem-v-${short}`, trackId: "vocal", name: `${short} · вокал`, startBar: 0, lengthBars: 16, key: "Am", bpm: 120, transpose: 0, fromStems: true, wave: makeWave(1213) },
    { id: `stem-b-${short}`, trackId: "beat", name: `${short} · бит`, startBar: 0, lengthBars: 16, key: "—", bpm: 120, transpose: 0, fromStems: true, wave: makeWave(1319) },
    { id: `stem-s-${short}`, trackId: "bass", name: `${short} · бас`, startBar: 0, lengthBars: 16, key: "Am", bpm: 120, transpose: 0, fromStems: true, wave: makeWave(1421) },
    { id: `stem-y-${short}`, trackId: "synth", name: `${short} · синт`, startBar: 0, lengthBars: 12, key: "Am", bpm: 120, transpose: 0, fromStems: true, wave: makeWave(1523) },
  ];
}

/* ——— Библиотека сэмплов ——— */

export const SAMPLE_GENRES: SampleGenre[] = ["lo-fi", "synthwave", "оркестр", "эмбиент"];
export const SAMPLE_TYPES: SampleType[] = ["барабаны", "бас", "пад", "вокал", "FX"];
export const SAMPLE_BPM_RANGES: SampleBpmRange[] = ["60–90", "90–120", "120+"];

export function sampleInRange(bpm: number, range: SampleBpmRange): boolean {
  if (range === "60–90") return bpm >= 60 && bpm < 90;
  if (range === "90–120") return bpm >= 90 && bpm <= 120;
  return bpm > 120;
}

export const SAMPLES: SampleItem[] = [
  { id: "smp-01", name: "лоу-фай барабаны «ночь»", genre: "lo-fi", type: "барабаны", bpm: 82, key: "Am", lengthBars: 4, gradient: "linear-gradient(135deg,#34d399,#065f46)", wave: makeWave(23), createdAtMs: NOW - 2 * HOUR },
  { id: "smp-02", name: "тёплый саб-бас", genre: "lo-fi", type: "бас", bpm: 78, key: "F#m", lengthBars: 4, gradient: "linear-gradient(135deg,#a8a29e,#44403c)", wave: makeWave(37), createdAtMs: NOW - 5 * HOUR },
  { id: "smp-03", name: "синтвейв-лид «неон»", genre: "synthwave", type: "пад", bpm: 112, key: "Am", lengthBars: 8, gradient: "linear-gradient(135deg,#fb7185,#9f1239)", wave: makeWave(41), createdAtMs: NOW - 1 * DAY },
  { id: "smp-04", name: "стаккато-струнные", genre: "оркестр", type: "пад", bpm: 96, key: "Dm", lengthBars: 4, gradient: "linear-gradient(135deg,#fbbf24,#92400e)", wave: makeWave(53), createdAtMs: NOW - 2 * DAY },
  { id: "smp-05", name: "стеклянный пад «рассвет»", genre: "эмбиент", type: "пад", bpm: 64, key: "Em", lengthBars: 8, gradient: "linear-gradient(135deg,#5eead4,#0f766e)", wave: makeWave(67), createdAtMs: NOW - 3 * DAY },
  { id: "smp-06", name: "вокс-хук «эй»", genre: "synthwave", type: "вокал", bpm: 105, key: "Am", lengthBars: 2, gradient: "linear-gradient(135deg,#f472b6,#be185d)", wave: makeWave(71), createdAtMs: NOW - 4 * DAY },
  { id: "smp-07", name: "футуристичный FX-свип", genre: "эмбиент", type: "FX", bpm: 70, key: "—", lengthBars: 2, gradient: "linear-gradient(135deg,#d6d3d1,#78716c)", wave: makeWave(83), createdAtMs: NOW - 5 * DAY },
  { id: "smp-08", name: "оркестровый кик", genre: "оркестр", type: "барабаны", bpm: 88, key: "Cm", lengthBars: 2, gradient: "linear-gradient(135deg,#d97706,#7c2d12)", wave: makeWave(97), createdAtMs: NOW - 6 * DAY },
  { id: "smp-09", name: "гулкий снейр 80-х", genre: "synthwave", type: "барабаны", bpm: 118, key: "Am", lengthBars: 4, gradient: "linear-gradient(135deg,#fb923c,#9a3412)", wave: makeWave(113), createdAtMs: NOW - 7 * DAY },
  { id: "smp-10", name: "шёпот-атмосфера", genre: "эмбиент", type: "вокал", bpm: 60, key: "—", lengthBars: 8, gradient: "linear-gradient(135deg,#99f6e4,#115e59)", wave: makeWave(127), createdAtMs: NOW - 9 * DAY },
  { id: "smp-11", name: "пробас «подвал»", genre: "lo-fi", type: "бас", bpm: 90, key: "Gm", lengthBars: 4, gradient: "linear-gradient(135deg,#a3e635,#3f6212)", wave: makeWave(139), createdAtMs: NOW - 12 * DAY },
  { id: "smp-12", name: "хай-хэт свинг", genre: "lo-fi", type: "барабаны", bpm: 82, key: "—", lengthBars: 2, gradient: "linear-gradient(135deg,#2dd4bf,#134e4a)", wave: makeWave(149), createdAtMs: NOW - 14 * DAY },
];

/* ——— Секвенсор бита ——— */

export const BEAT_ROW_NAMES = ["Кик", "Снейр", "Хэт", "Клэп"];
export const BEAT_ROW_COLORS = ["#34d399", "#fbbf24", "#2dd4bf", "#fb7185"];

/** Строки → полная сетка 4×16. */
function grid(rows: number[][]): boolean[][] {
  return rows.map((row) => Array.from({ length: 16 }, (_, i) => row.includes(i)));
}

export const BEAT_PRESETS: BeatPreset[] = [
  { id: "basic", name: "Базовый", steps: grid([[0, 4, 8, 12], [4, 12], [0, 2, 4, 6, 8, 10, 12, 14], [12]]) },
  { id: "broken", name: "Ломаный", steps: grid([[0, 3, 6, 10], [4, 12], [1, 5, 7, 11, 13, 15], [7]]) },
  { id: "half", name: "Половинный", steps: grid([[0, 11], [8], [0, 4, 8, 12], [15]]) },
];

export const DEFAULT_BEAT: boolean[][] = BEAT_PRESETS[0].steps;

/* ——— Служебное ——— */

let seq = 0;
/** Генератор id для новых клипов. */
export function nextClipId(): string {
  seq += 1;
  return `clip-new-${seq}-${Math.random().toString(36).slice(2, 7)}`;
}

let sampleSeq = 0;
/** Генератор id для новых сэмплов. */
export function nextSampleId(): string {
  sampleSeq += 1;
  return `smp-new-${sampleSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Русская подпись полутонов: 0 → «0 пт», 3 → «+3 пт», −12 → «−12 пт». */
export function semitoneLabel(v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v)} пт`;
}

/** Панорама: −100…100 → «L 20» / «Центр» / «R 35». */
export function panLabel(v: number): string {
  if (v === 0) return "Центр";
  return `${v < 0 ? "L" : "R"} ${Math.abs(Math.round(v))}`;
}

/** Децибелы громкости 0–100 → «−6,0» / «−∞». */
export function volumeDb(v: number): string {
  if (v <= 0) return "−∞";
  const db = 20 * Math.log10(v / 100);
  return db.toFixed(1).replace(".", ",");
}
