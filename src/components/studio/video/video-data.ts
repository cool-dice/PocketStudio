/**
 * Mock data for the Video module (pocket movie studio).
 * Pure static content — the screen is a visual-first prototype,
 * no fetch/API behind it yet.
 */

import type { LucideIcon } from "lucide-react";
import {
  Clapperboard,
  LayoutGrid,
  Mic,
  Moon,
  Music,
  Orbit,
  PenLine,
  Radio,
  Rocket,
  Satellite,
  Scissors,
  Sparkles,
  Star,
  Waves,
} from "lucide-react";

/* ── Проект ─────────────────────────────────────────────────────────── */

export const PROJECTS = [
  "Созвездие Пикселя — трейлер",
  "Хроники Долгой Зимы — часть I",
  "Демо-ролик обновления",
  "Курс «Свет в кадре»",
  "Космос — вертикальный шортс",
];

/** Полный метр, который монтируется во вкладке «Монтаж» (NLE). */
export const FILM_PROJECT = "Хроники Долгой Зимы — часть I";

/* ── Сцены (раскадровка) ────────────────────────────────────────────── */

export type SceneStatus = "done" | "generating" | "pending";

export interface SceneCard {
  id: number;
  title: string;
  duration: number;
  status: SceneStatus;
  /** Tailwind gradient classes for the thumbnail */
  gradient: string;
  icon: LucideIcon;
}

export const SCENES: SceneCard[] = [
  {
    id: 1,
    title: "Пробуждение станции",
    duration: 12,
    status: "done",
    gradient: "from-stone-800 via-stone-900 to-black",
    icon: Satellite,
  },
  {
    id: 2,
    title: "Звёздная карта",
    duration: 18,
    status: "done",
    gradient: "from-emerald-950 via-emerald-900 to-stone-900",
    icon: Star,
  },
  {
    id: 3,
    title: "Погоня в поясе астероидов",
    duration: 15,
    status: "generating",
    gradient: "from-stone-700 via-stone-800 to-emerald-950",
    icon: Rocket,
  },
  {
    id: 4,
    title: "Тишина туманности",
    duration: 25,
    status: "pending",
    gradient: "from-stone-300 via-stone-400 to-stone-600",
    icon: Moon,
  },
  {
    id: 5,
    title: "Сигнал из глубины",
    duration: 20,
    status: "done",
    gradient: "from-emerald-700 via-emerald-800 to-stone-700",
    icon: Radio,
  },
  {
    id: 6,
    title: "Мостик двух миров",
    duration: 14,
    status: "pending",
    gradient: "from-stone-800 via-emerald-950 to-black",
    icon: Orbit,
  },
  {
    id: 7,
    title: "Созвездие Пикселя",
    duration: 16,
    status: "pending",
    gradient: "from-emerald-800 via-stone-700 to-stone-900",
    icon: Sparkles,
  },
  {
    id: 8,
    title: "Титры на орбите",
    duration: 10,
    status: "pending",
    gradient: "from-black via-stone-900 to-stone-800",
    icon: Clapperboard,
  },
];

export const SCENE_STATUS_LABEL: Record<SceneStatus, string> = {
  done: "Готов",
  generating: "Генерация",
  pending: "Ожидает",
};

/** Сцены, вошедшие в черновой монтаж (таймлайн). */
export const TIMELINE_SCENES = SCENES.slice(0, 5);

export const TOTAL_CUT_SECONDS = TIMELINE_SCENES.reduce(
  (acc, s) => acc + s.duration,
  0,
);

/** Позиция плейхеда в черновом монтаже. */
export const CURRENT_SECONDS = 34;

/* ── Конвейер производства ──────────────────────────────────────────── */

export interface PipelineStep {
  id: number;
  label: string;
  icon: LucideIcon;
}

export const PIPELINE_STEPS: PipelineStep[] = [
  { id: 0, label: "Сценарий", icon: PenLine },
  { id: 1, label: "Раскадровка", icon: LayoutGrid },
  { id: 2, label: "Кадры", icon: Clapperboard },
  { id: 3, label: "Озвучка", icon: Mic },
  { id: 4, label: "Монтаж", icon: Scissors },
];

/** Индекс шага, над которым идёт работа прямо сейчас. */
export const ACTIVE_STEP = 2;

/* ── Сценарий активной сцены ────────────────────────────────────────── */

export interface DialogueLine {
  who: "ЛИСА" | "ПИКСЕЛЬ";
  text: string;
}

export const SCRIPT = {
  sceneId: 3,
  title: "Погоня в поясе астероидов",
  description:
    "Станция тонет в рыжем свете тревоги. Лиса ведёт корабль сквозь пояс астероидов, и каждый удар гасит одну звезду на карте. В отражении шлема Пикселя впервые проступает созвездие — путь домой.",
  dialogue: [
    { who: "ЛИСА", text: "— Держись! Ещё три оборота — и мы внутри туманности." },
    { who: "ПИКСЕЛЬ", text: "— Я вижу узор… Это не просто звёзды, Лиса. Это дорога." },
    { who: "ЛИСА", text: "— Тогда не моргай. Нарисуй его мне наизусть." },
  ] satisfies DialogueLine[],
  directorNote:
    "Дать тишину за полсекунды до реплики Пикселя — момент должен дышать. Вторую половину погони ускорить на 6 %.",
};

/* ── Кадры (shot list) ──────────────────────────────────────────────── */

export type ShotStatus = "ready" | "render" | "draft";

export interface Shot {
  id: number;
  plan: "Общий" | "Средний" | "Крупный" | "Деталь";
  camera: string;
  duration: number;
  status: ShotStatus;
}

export const SHOT_STATUS_LABEL: Record<ShotStatus, string> = {
  ready: "Готов",
  render: "Рендер",
  draft: "Черновик",
};

export const SHOTS: Shot[] = [
  { id: 1, plan: "Общий", camera: "Долли-ин на станцию", duration: 3, status: "ready" },
  { id: 2, plan: "Средний", camera: "Ручная камера, кабина", duration: 2, status: "ready" },
  { id: 3, plan: "Деталь", camera: "Статика, дрожь штурвала", duration: 2, status: "ready" },
  { id: 4, plan: "Крупный", camera: "Тревеллинг, лицо Лисы", duration: 3, status: "render" },
  { id: 5, plan: "Общий", camera: "Кран назад, пояс астероидов", duration: 3, status: "render" },
  { id: 6, plan: "Крупный", camera: "Статика, отражение в шлеме", duration: 1, status: "draft" },
  { id: 7, plan: "Деталь", camera: "Макро, пиксель на карте", duration: 1, status: "draft" },
];

/* ── Звуковые слои ──────────────────────────────────────────────────── */

export interface AudioLayerInit {
  id: string;
  kind: string;
  name: string;
  detail: string;
  icon: LucideIcon;
  volume: number;
}

export const AUDIO_LAYERS: AudioLayerInit[] = [
  {
    id: "music",
    kind: "Музыка",
    name: "Эмбиент «Орбита»",
    detail: "42 слоя · 48 кГц · стерео",
    icon: Music,
    volume: 62,
  },
  {
    id: "voice",
    kind: "Голос",
    name: "Алиса — рассказчица",
    detail: "Русская озвучка · нейросеть",
    icon: Mic,
    volume: 88,
  },
  {
    id: "sfx",
    kind: "Шумы",
    name: "Космос: гул и помехи",
    detail: "12 источников · зациклено",
    icon: Waves,
    volume: 45,
  },
];

/* ── Хелперы ────────────────────────────────────────────────────────── */

/** 90 → «1:30», 34 → «0:34». */
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
