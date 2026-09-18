/**
 * Mock data for the «Монтаж» tab (NLE, Premiere/Vegas-lite).
 * Фильм «Хроники Долгой Зимы · часть I» — 14:32, цель 10–20 мин.
 * Pure static content: no fetch/API behind it yet.
 */

import type { LucideIcon } from "lucide-react";
import {
  Blend,
  Flame,
  Film,
  Layers,
  Library,
  Mic,
  MoveHorizontal,
  Mountain,
  Music,
  Scissors,
  Ship,
  Snowflake,
  Star,
  Sunrise,
  Type,
  Wind,
  AudioLines,
  Palette,
  Upload,
} from "lucide-react";

/* ── Константы проекта ──────────────────────────────────────────────── */

export const FILM_TITLE = "ХРОНИКИ ДОЛГОЙ ЗИМЫ";
export const FILM_SUBTITLE = "часть I · Прошло семь лет…";
/** 14:32,72 — полный хронометраж смонтированного фильма. */
export const FILM_SECONDS = 872;
export const TARGET_RANGE = "10–20 мин";
export const PERSPECTIVE = "до 2 ч";
export const FPS = 25;
/** Начальная позиция плейхеда: 00:14:32:18. */
export const INITIAL_PLAYHEAD = 872.72;
/** Шкала линейки — 15 минут + запас под добавленные клипы. */
export const RULER_SECONDS = 900;
/** Пикселей на секунду для трёх уровней зума. */
export const PPS_LEVELS = [0.8, 1.6, 3.2] as const;
export const PPS_LABELS = ["50 %", "100 %", "200 %"] as const;
/** Ширина заголовков дорожек (px) — константа для расчёта плейхеда. */
export const HEADER_W = 112;

/* ── Типы ──────────────────────────────────────────────────────────── */

export type ClipKind = "video" | "audio" | "title" | "image";
export type TrackId = "v2" | "v1" | "a1" | "a2" | "titles";
export type LutId = "warm" | "cold" | "night" | "retro" | "bw";
export type TransitionId = "dissolve" | "slide" | "fade";
export type FontId = "serif" | "sans" | "mono";
export type TitlePosition = "top" | "center" | "bottom";

export interface NleClip {
  id: string;
  trackId: TrackId;
  kind: ClipKind;
  name: string;
  /** Позиция на таймлайне, с. */
  start: number;
  /** Длительность на таймлайне, с (с учётом скорости). */
  duration: number;
  /** Точка входа в исходнике, с. */
  inPoint: number;
  gradient: string;
  icon: LucideIcon;
  speed: number;
  lut?: LutId | null;
  transition?: TransitionId | null;
  /* Титры */
  text?: string;
  font?: FontId;
  size?: number;
  position?: TitlePosition;
}

export interface NleTrackDef {
  id: TrackId;
  label: string;
  short: string;
  kind: "video" | "audio" | "title";
  height: number;
  icon: LucideIcon;
  volume: number;
}

export const TRACKS: NleTrackDef[] = [
  { id: "v2", label: "V2 · Оверлеи", short: "V2", kind: "video", height: 56, icon: Layers, volume: 80 },
  { id: "v1", label: "V1 · Основное видео", short: "V1", kind: "video", height: 60, icon: Film, volume: 100 },
  { id: "a1", label: "A1 · Диалоги и озвучка", short: "A1", kind: "audio", height: 52, icon: Mic, volume: 92 },
  { id: "a2", label: "A2 · Музыка", short: "A2", kind: "audio", height: 52, icon: Music, volume: 55 },
  { id: "titles", label: "Титры", short: "Т", kind: "title", height: 48, icon: Type, volume: 100 },
];

export const TRACK_BY_ID: Record<TrackId, NleTrackDef> = Object.fromEntries(
  TRACKS.map((t) => [t.id, t]),
) as Record<TrackId, NleTrackDef>;

/* ── LUT-пресеты цветокора ──────────────────────────────────────────── */

export interface LutPreset {
  id: LutId;
  name: string;
  gradient: string;
  filter: string;
}

export const LUTS: LutPreset[] = [
  { id: "warm", name: "Тёплый", gradient: "from-amber-300 via-orange-400 to-rose-500", filter: "sepia(0.35) saturate(1.35) contrast(1.05)" },
  { id: "cold", name: "Холодный", gradient: "from-teal-200 via-emerald-400 to-emerald-700", filter: "saturate(0.85) hue-rotate(12deg) brightness(1.06)" },
  { id: "night", name: "Ночь", gradient: "from-stone-900 via-emerald-950 to-black", filter: "brightness(0.55) saturate(1.2) contrast(1.15)" },
  { id: "retro", name: "Ретро", gradient: "from-amber-200 via-stone-400 to-stone-600", filter: "sepia(0.5) contrast(1.12) brightness(0.92)" },
  { id: "bw", name: "Ч-Б", gradient: "from-stone-100 via-stone-300 to-stone-500", filter: "grayscale(1) contrast(1.15)" },
];

export const LUT_BY_ID: Record<LutId, LutPreset> = Object.fromEntries(
  LUTS.map((l) => [l.id, l]),
) as Record<LutId, LutPreset>;

/* ── Переходы ───────────────────────────────────────────────────────── */

export interface TransitionDef {
  id: TransitionId;
  name: string;
  icon: LucideIcon;
}

export const TRANSITIONS: TransitionDef[] = [
  { id: "dissolve", name: "Растворение", icon: Blend },
  { id: "slide", name: "Сдвиг", icon: MoveHorizontal },
  { id: "fade", name: "Затемнение", icon: Sunrise },
];

export const TRANSITION_BY_ID: Record<TransitionId, TransitionDef> =
  Object.fromEntries(TRANSITIONS.map((t) => [t.id, t])) as Record<
    TransitionId,
    TransitionDef
  >;

export const CLIP_KIND_LABEL: Record<ClipKind, string> = {
  video: "Видео",
  audio: "Аудио",
  title: "Титр",
  image: "Изображение",
};

export const FONT_OPTIONS: { id: FontId; name: string; className: string }[] = [
  { id: "serif", name: "Антиква", className: "font-serif" },
  { id: "sans", name: "Гротеск", className: "font-sans" },
  { id: "mono", name: "Моно", className: "font-mono" },
];

export const FONT_CLASS: Record<FontId, string> = {
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
};

/* ── Медиатека (каталогизация) ─────────────────────────────────────── */

export interface MediaItem {
  id: string;
  name: string;
  type: ClipKind;
  /** Для аудио: роль — голос или музыка. */
  role?: "voice" | "music";
  /** Тег каталогизации: Сцена 01–08 / Озвучка / Музыка. */
  tag: string | null;
  duration: number;
  gradient: string;
  icon: LucideIcon;
  /** Дата добавления, ISO — для сортировки «по дате». */
  date: string;
  meta: string;
}

export const MEDIA_TYPE_FILTERS: { id: ClipKind | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "video", label: "Видео" },
  { id: "audio", label: "Аудио" },
  { id: "title", label: "Титры" },
  { id: "image", label: "Изображения" },
];

export const MEDIA_TAGS: string[] = [
  "Сцена 01", "Сцена 02", "Сцена 03", "Сцена 04",
  "Сцена 05", "Сцена 06", "Сцена 07", "Сцена 08",
  "Озвучка", "Музыка",
];

export const MEDIA_ITEMS: MediaItem[] = [
  { id: "m1", name: "Сцена 01 — Первая метель", type: "video", tag: "Сцена 01", duration: 38, gradient: "from-stone-200 via-stone-400 to-stone-600", icon: Wind, date: "2025-02-18", meta: "1080p · 24 к/с · сгенерировано" },
  { id: "m2", name: "Сцена 02 — Ледяная гавань", type: "video", tag: "Сцена 02", duration: 65, gradient: "from-teal-200 via-emerald-400 to-emerald-800", icon: Ship, date: "2025-02-21", meta: "1080p · 24 к/с · сгенерировано" },
  { id: "m3", name: "Сцена 03 — Мост через бездну", type: "video", tag: "Сцена 03", duration: 42, gradient: "from-stone-600 via-stone-800 to-black", icon: MoveHorizontal, date: "2025-02-24", meta: "1080p · 24 к/с · сгенерировано" },
  { id: "m4", name: "Сцена 04 — Библиотека в инее", type: "video", tag: "Сцена 04", duration: 57, gradient: "from-amber-100 via-amber-300 to-emerald-900", icon: Library, date: "2025-02-26", meta: "1080p · 24 к/с · сгенерировано" },
  { id: "m5", name: "Сцена 05 — Пожар маяка", type: "video", tag: "Сцена 05", duration: 70, gradient: "from-amber-400 via-rose-500 to-stone-900", icon: Flame, date: "2025-02-27", meta: "1080p · 24 к/с · сгенерировано" },
  { id: "m6", name: "Сцена 06 — Волки на льду", type: "video", tag: "Сцена 06", duration: 33, gradient: "from-stone-100 via-teal-300 to-emerald-700", icon: Snowflake, date: "2025-03-01", meta: "1080p · 24 к/с · сгенерировано" },
  { id: "m7", name: "Сцена 07 — Испытание холодом", type: "video", tag: "Сцена 07", duration: 48, gradient: "from-emerald-200 via-emerald-600 to-stone-900", icon: Star, date: "2025-03-03", meta: "1080p · 24 к/с · сгенерировано" },
  { id: "m8", name: "Сцена 08 — Рассвет над фьордом", type: "video", tag: "Сцена 08", duration: 72, gradient: "from-amber-200 via-rose-300 to-teal-700", icon: Sunrise, date: "2025-03-05", meta: "1080p · 24 к/с · сгенерировано" },
  { id: "m9", name: "Озвучка — Маркел, гл. 3", type: "audio", role: "voice", tag: "Озвучка", duration: 245, gradient: "from-emerald-700 via-emerald-600 to-emerald-900", icon: Mic, date: "2025-03-02", meta: "Голос «Маркел» · 48 кГц" },
  { id: "m10", name: "Озвучка — Ирма, гл. 3", type: "audio", role: "voice", tag: "Озвучка", duration: 152, gradient: "from-teal-700 via-emerald-600 to-stone-800", icon: Mic, date: "2025-03-04", meta: "Голос «Ирма» · 48 кГц" },
  { id: "m11", name: "Музыка — «Долгая зима», тема", type: "audio", role: "music", tag: "Музыка", duration: 188, gradient: "from-emerald-800 via-teal-700 to-stone-900", icon: Music, date: "2025-02-25", meta: "AI-генерация · эмбиент" },
  { id: "m12", name: "Титр — «ГЛАВА ПЕРВАЯ»", type: "title", tag: null, duration: 6, gradient: "from-stone-800 via-stone-900 to-black", icon: Type, date: "2025-02-19", meta: "Антиква · 34 px" },
  { id: "m13", name: "Титр — «Прошло семь лет…»", type: "title", tag: null, duration: 5, gradient: "from-stone-700 via-stone-800 to-stone-950", icon: Type, date: "2025-02-19", meta: "Антиква · 30 px" },
  { id: "m14", name: "Изображение — Карта Северного предела", type: "image", tag: null, duration: 42, gradient: "from-amber-100 via-stone-300 to-emerald-800", icon: Mountain, date: "2025-02-22", meta: "2048×1152 · PNG" },
  { id: "m15", name: "Изображение — Герб дома Маркела", type: "image", tag: null, duration: 6, gradient: "from-stone-300 via-amber-200 to-stone-600", icon: Star, date: "2025-02-18", meta: "1024×1024 · PNG" },
];

/** На какую дорожку попадает элемент медиатеки. */
export function trackForItem(item: MediaItem): TrackId {
  if (item.type === "video") return "v1";
  if (item.type === "image") return "v2";
  if (item.type === "title") return "titles";
  return item.role === "music" ? "a2" : "a1";
}

/* ── Пайплайн сборки фильма ─────────────────────────────────────────── */

export interface AssembleStep {
  id: number;
  label: string;
  detail: string;
  icon: LucideIcon;
}

export const ASSEMBLE_STEPS: AssembleStep[] = [
  { id: 0, label: "Черновой монтаж", detail: "склейка 33 клипов · 5 дорожек", icon: Scissors },
  { id: 1, label: "Цветокоррекция", detail: "LUT-пресеты · соответствие сцен", icon: Palette },
  { id: 2, label: "Звук", detail: "диалоги · музыка · −14 LUFS", icon: AudioLines },
  { id: 3, label: "Титры", detail: "4 титровых блока · субтитры", icon: Type },
  { id: 4, label: "Экспорт", detail: "H.264 · 1080p · 24 к/с", icon: Upload },
];

/* ── Исходные клипы таймлайна ───────────────────────────────────────── */

export function buildInitialClips(): NleClip[] {
  let seq = 0;
  const mk = (
    trackId: TrackId,
    kind: ClipKind,
    name: string,
    start: number,
    duration: number,
    gradient: string,
    icon: LucideIcon,
    extra?: Partial<NleClip>,
  ): NleClip => ({
    id: `c${++seq}`,
    trackId,
    kind,
    name,
    start,
    duration,
    inPoint: 0,
    gradient,
    icon,
    speed: 1,
    ...extra,
  });

  const G1 = "from-stone-200 via-stone-400 to-stone-600";
  const G2 = "from-teal-200 via-emerald-400 to-emerald-800";
  const G3 = "from-stone-600 via-stone-800 to-black";
  const G4 = "from-amber-100 via-amber-300 to-emerald-900";
  const G5 = "from-amber-400 via-rose-500 to-stone-900";
  const G6 = "from-stone-100 via-teal-300 to-emerald-700";
  const G7 = "from-emerald-200 via-emerald-600 to-stone-900";
  const G8 = "from-amber-200 via-rose-300 to-teal-700";
  const GV = "from-emerald-700 via-emerald-600 to-emerald-900";
  const GM = "from-emerald-800 via-teal-700 to-stone-900";
  const GT = "from-stone-800 via-stone-900 to-black";

  return [
    /* V1 — основное видео (сумма = 872 с = 14:32) */
    mk("v1", "video", "Сцена 01 — Первая метель", 0, 38, G1, Wind),
    mk("v1", "video", "Сцена 02 — Ледяная гавань", 38, 65, G2, Ship, { transition: "dissolve" }),
    mk("v1", "video", "Сцена 03 — Мост через бездну", 103, 42, G3, MoveHorizontal),
    mk("v1", "video", "Сцена 03 — Мост через бездну · ч. 2", 145, 38, G3, MoveHorizontal, { inPoint: 42 }),
    mk("v1", "video", "Сцена 04 — Библиотека в инее", 183, 57, G4, Library, { lut: "warm" }),
    mk("v1", "video", "Сцена 05 — Пожар маяка", 240, 70, G5, Flame, { transition: "fade" }),
    mk("v1", "video", "Сцена 05 — Пожар маяка · кульминация", 310, 55, G5, Flame, { inPoint: 70 }),
    mk("v1", "video", "Сцена 06 — Волки на льду", 365, 33, G6, Snowflake),
    mk("v1", "video", "Сцена 07 — Испытание холодом", 398, 48, G7, Star),
    mk("v1", "video", "Сцена 07 — Испытание холодом · финал", 446, 62, G7, Star, { inPoint: 48 }),
    mk("v1", "video", "Сцена 08 — Рассвет над фьордом", 508, 72, G8, Sunrise, { lut: "cold" }),
    mk("v1", "video", "Сцена 08 — Рассвет над фьордом · проход", 580, 85, G8, Sunrise, { lut: "cold", inPoint: 72 }),
    mk("v1", "video", "Эпилог — дорога на юг", 665, 90, G1, Wind, { transition: "slide" }),
    mk("v1", "video", "Финальное затемнение", 755, 105, "from-stone-900 via-stone-950 to-black", Wind),
    mk("v1", "video", "Конец — карточка части I", 860, 12.72, "from-emerald-950 via-stone-950 to-black", Star),
    /* V2 — оверлеи */
    mk("v2", "image", "Герб дома Маркела", 0, 6, "from-stone-300 via-amber-200 to-stone-600", Star),
    mk("v2", "image", "Карта Северного предела", 108, 42, "from-amber-100 via-stone-300 to-emerald-800", Mountain),
    mk("v2", "video", "Вьюга — частицы", 240, 65, "from-stone-100 via-stone-300 to-stone-600", Wind),
    mk("v2", "video", "Отражение в льду", 446, 62, G6, Snowflake),
    mk("v2", "video", "Виньетка фьорда", 580, 85, "from-emerald-900 via-emerald-800 to-stone-900", Sunrise),
    /* A1 — диалоги и озвучка */
    mk("a1", "audio", "Рассказчик — пролог", 2, 36, GV, Mic),
    mk("a1", "audio", "Озвучка — Маркел, гл. 3", 110, 155, GV, Mic),
    mk("a1", "audio", "Озвучка — Ирма, гл. 3", 268, 92, "from-teal-700 via-emerald-600 to-stone-800", Mic),
    mk("a1", "audio", "Диалог на мосту", 365, 84, GV, Mic),
    mk("a1", "audio", "Финальный монолог Маркела", 600, 96, GV, Mic),
    /* A2 — музыка */
    mk("a2", "audio", "Тема «Долгая зима»", 0, 188, GM, Music),
    mk("a2", "audio", "Волчья погоня — перкуссия", 356, 65, GM, Music),
    mk("a2", "audio", "Тема рассвета — струнные", 580, 180, GM, Music),
    mk("a2", "audio", "Эпилог — одинокое пиано", 760, 112.72, GM, Music),
    /* Титры */
    mk("titles", "title", "ГЛАВА ПЕРВАЯ", 12, 6, GT, Type, { text: "ГЛАВА ПЕРВАЯ", font: "serif", size: 34, position: "center" }),
    mk("titles", "title", "Прошло семь лет…", 52, 5, GT, Type, { text: "Прошло семь лет…", font: "serif", size: 30, position: "bottom" }),
    mk("titles", "title", "Хроники Долгой Зимы", 585, 8, GT, Type, { text: "ХРОНИКИ ДОЛГОЙ ЗИМЫ", font: "sans", size: 26, position: "center" }),
    mk("titles", "title", "Конец первой части", 858, 14.72, GT, Type, { text: "Конец первой части", font: "serif", size: 28, position: "center" }),
  ];
}

/* ── Хелперы ────────────────────────────────────────────────────────── */

/** 872 → «14:32», 42 → «0:42». */
export function formatDur(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 872.72 → «00:14:32:18» (часы:минуты:секунды:кадры). */
export function formatTc(seconds: number, fps = FPS): string {
  const clamped = Math.max(0, seconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const f = Math.floor((clamped % 1) * fps);
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${p2(h)}:${p2(m)}:${p2(s)}:${p2(f)}`;
}

/** Дата ISO → «18 фев». */
export function formatDateRu(iso: string): string {
  const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS[m - 1]}`;
}
