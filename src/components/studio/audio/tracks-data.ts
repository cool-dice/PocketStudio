import type { LucideIcon } from "lucide-react";
import {
  AudioWaveform,
  CloudDrizzle,
  Coffee,
  Megaphone,
  Music,
  Orbit,
  Podcast,
  Radio,
  Waves,
} from "lucide-react";

/** —— Доменные типы аудиостудии (визуальный макет) —— */

export type TrackType = "voice" | "music" | "podcast" | "noise";
export type TrackStatus = "ready" | "generating" | "queued";
export type TrackMood = "Спокойное" | "Энергичное" | "Эпичное" | "Лиричное";

export const TRACK_MOODS: TrackMood[] = ["Спокойное", "Энергичное", "Эпичное", "Лиричное"];

export interface AudioTrack {
  id: string;
  title: string;
  type: TrackType;
  /** Короткая мета: голос, жанр или атмосфера. */
  meta: string;
  durationSec: number;
  status: TrackStatus;
  gradient: string;
  icon: LucideIcon;
  createdAt: string;
  /** Для сортировки по дате (мс). */
  createdAtMs: number;
  /** Настроение — фильтр-чип каталогизации. */
  mood: TrackMood;
  /** Темп дорожки. */
  bpm: number;
  /** Тональность («Am», «F#m», «—» если неприменимо). */
  key: string;
  /** 24 высоты полос волны (0–100) — детерминированная псевдослучайная форма. */
  bars: number[];
}

export const TRACK_TYPE_LABEL: Record<TrackType, string> = {
  voice: "Озвучка",
  music: "Музыка",
  podcast: "Подкаст",
  noise: "Шум",
};

export const TRACK_TYPE_DOT: Record<TrackType, string> = {
  voice: "bg-emerald-500",
  music: "bg-amber-500",
  podcast: "bg-teal-500",
  noise: "bg-stone-400",
};

export const TRACK_STATUS_META: Record<TrackStatus, { label: string; className: string }> = {
  ready: {
    label: "Готово",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  generating: {
    label: "Генерация",
    className:
      "animate-pulse border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  queued: {
    label: "Очередь",
    className: "border-stone-400/40 bg-stone-400/10 text-stone-600 dark:text-stone-400",
  },
};

/** —— Пресеты генерации —— */

export const VOICES = [
  {
    id: "alisa",
    name: "Алиса",
    initials: "А",
    role: "Тёплый рассказчик",
    note: "мягкие интонации",
    gradient: "linear-gradient(135deg,#34d399,#059669)",
  },
  {
    id: "mark",
    name: "Марк",
    initials: "М",
    role: "Глубокий бас",
    note: "документальный тон",
    gradient: "linear-gradient(135deg,#a1a1aa,#3f3f46)",
  },
  {
    id: "nika",
    name: "Ника",
    initials: "Н",
    role: "Энергичная",
    note: "живой темп, драйв",
    gradient: "linear-gradient(135deg,#fbbf24,#d97706)",
  },
  {
    id: "sasha",
    name: "Саша",
    initials: "С",
    role: "Спокойная",
    note: "ровный, мягкий голос",
    gradient: "linear-gradient(135deg,#5eead4,#0d9488)",
  },
] as const;

export const MUSIC_GENRES = ["Лоу-фай", "Эмбиент", "Электроника", "Оркестровое", "Джаз", "Синтвейв"];
export const MUSIC_MOODS = ["Спокойное", "Эпичное", "Игривое", "Мрачное"];
export const MUSIC_DURATIONS = ["30 сек", "1 мин", "3 мин"];
export const PODCAST_LENGTHS = ["15 мин", "30 мин", "60 мин"];
export const AMBIENCES = ["Дождь", "Кофейня", "Лес", "Город", "Океан"];

/** —— Утилиты —— */

/** Детерминированная «волна» дорожки (Park–Miller + огибающая синусом). */
function makeBars(seed: number, n = 24): number[] {
  const bars: number[] = [];
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  for (let i = 0; i < n; i++) {
    x = (x * 16807) % 2147483647;
    const envelope = 0.45 + 0.55 * Math.sin((Math.PI * (i + 0.5)) / n);
    bars.push(Math.round(22 + (x / 2147483647) * 78 * envelope));
  }
  return bars;
}

export function formatTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 1 → «1×», 0.75 → «0,75×» — по-русски, с запятой. */
export function formatSpeed(v: number): string {
  return `${String(v).replace(".", ",")}×`;
}

/** —— Библиотека студии: 10 дорожек —— */

/** Фиксированное «сегодня» мок-данных (для сортировки по дате). */
const NOW = 1_780_000_000_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export const TRACKS: AudioTrack[] = [
  {
    id: "trk-01",
    title: "Интро к подкасту студии",
    type: "podcast",
    meta: "Дуэт ведущих · интро",
    durationSec: 22,
    status: "ready",
    gradient: "linear-gradient(135deg,#0d9488,#115e59)",
    icon: Podcast,
    createdAt: "Сегодня, 10:14",
    createdAtMs: NOW - 2 * HOUR,
    mood: "Энергичное",
    bpm: 92,
    key: "—",
    bars: makeBars(17),
  },
  {
    id: "trk-02",
    title: "Лоу-фай для написания глав",
    type: "music",
    meta: "Лоу-фай · Спокойное",
    durationSec: 225,
    status: "ready",
    gradient: "linear-gradient(135deg,#059669,#064e3b)",
    icon: Music,
    createdAt: "Сегодня, 09:02",
    createdAtMs: NOW - 5 * HOUR,
    mood: "Спокойное",
    bpm: 78,
    key: "Am",
    bars: makeBars(31),
  },
  {
    id: "trk-03",
    title: "Глава 4 — начитка (Алиса)",
    type: "voice",
    meta: "Алиса · тёплый рассказчик",
    durationSec: 768,
    status: "ready",
    gradient: "linear-gradient(135deg,#b45309,#7c2d12)",
    icon: AudioWaveform,
    createdAt: "Вчера, 21:40",
    createdAtMs: NOW - 14 * HOUR,
    mood: "Лиричное",
    bpm: 84,
    key: "—",
    bars: makeBars(53),
  },
  {
    id: "trk-04",
    title: "Эмбиент: космос",
    type: "music",
    meta: "Эмбиент · Спокойное",
    durationSec: 330,
    status: "generating",
    gradient: "linear-gradient(135deg,#52525b,#18181b)",
    icon: Orbit,
    createdAt: "Вчера, 19:12",
    createdAtMs: NOW - 17 * HOUR,
    mood: "Спокойное",
    bpm: 62,
    key: "Em",
    bars: makeBars(71),
  },
  {
    id: "trk-05",
    title: "Дождь за окном кабинета",
    type: "noise",
    meta: "Дождь · интенсивность 60%",
    durationSec: 1800,
    status: "ready",
    gradient: "linear-gradient(135deg,#115e59,#134e4a)",
    icon: CloudDrizzle,
    createdAt: "Вчера, 15:30",
    createdAtMs: NOW - 20 * HOUR,
    mood: "Спокойное",
    bpm: 60,
    key: "—",
    bars: makeBars(97),
  },
  {
    id: "trk-06",
    title: "Промо-ролик студии",
    type: "voice",
    meta: "Марк · глубокий бас",
    durationSec: 45,
    status: "ready",
    gradient: "linear-gradient(135deg,#d97706,#92400e)",
    icon: Megaphone,
    createdAt: "2 дня назад",
    createdAtMs: NOW - 2 * DAY,
    mood: "Энергичное",
    bpm: 128,
    key: "Cm",
    bars: makeBars(41),
  },
  {
    id: "trk-07",
    title: "Синтвейв для титров",
    type: "music",
    meta: "Синтвейв · Эпичное",
    durationSec: 138,
    status: "queued",
    gradient: "linear-gradient(135deg,#9f1239,#4c0519)",
    icon: AudioWaveform,
    createdAt: "2 дня назад",
    createdAtMs: NOW - 2 * DAY - 3 * HOUR,
    mood: "Эпичное",
    bpm: 112,
    key: "F#m",
    bars: makeBars(67),
  },
  {
    id: "trk-08",
    title: "Выпуск #12: откуда брать сюжеты",
    type: "podcast",
    meta: "Один ведущий · 30 мин",
    durationSec: 1720,
    status: "ready",
    gradient: "linear-gradient(135deg,#3f6212,#1a2e05)",
    icon: Radio,
    createdAt: "3 дня назад",
    createdAtMs: NOW - 3 * DAY,
    mood: "Энергичное",
    bpm: 96,
    key: "—",
    bars: makeBars(83),
  },
  {
    id: "trk-09",
    title: "Кофейня: субботний полдень",
    type: "noise",
    meta: "Кофейня · интенсивность 45%",
    durationSec: 900,
    status: "queued",
    gradient: "linear-gradient(135deg,#a8a29e,#57534e)",
    icon: Coffee,
    createdAt: "4 дня назад",
    createdAtMs: NOW - 4 * DAY,
    mood: "Спокойное",
    bpm: 74,
    key: "—",
    bars: makeBars(29),
  },
  {
    id: "trk-10",
    title: "Финальные титры — оркестр",
    type: "music",
    meta: "Оркестровое · Эпичное",
    durationSec: 116,
    status: "generating",
    gradient: "linear-gradient(135deg,#10b981,#065f46)",
    icon: Waves,
    createdAt: "5 дней назад",
    createdAtMs: NOW - 5 * DAY,
    mood: "Эпичное",
    bpm: 88,
    key: "Dm",
    bars: makeBars(59),
  },
];
