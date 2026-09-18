/**
 * Главная — локальный набор данных дашборда (PS-3-a).
 *
 * Статистика студии (воркспейсы и артефакты считаются по мок-данным,
 * неделя — демо-цифра до Фазы A), лента активности по всем модулям
 * с тип-окрашенными иконками и мелкие утилиты приветствия.
 */

import {
  Activity,
  AudioWaveform,
  BookOpenText,
  Boxes,
  Clapperboard,
  FileCode2,
  ImagePlus,
  Layers,
  Mic,
  NotebookPen,
  Rocket,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { MOCK_ARTIFACTS } from "@/components/workspaces/shared/artifacts-data";
import { MOCK_WORKSPACES } from "@/lib/workspace-data";

// ─────────────────────── приветствие ───────────────────────

/** «Четверг, 18 сентября» — строка даты для шапки дашборда. */
export function homeDateLine(now: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Первое слово имени: «Тест Студии» → «Тест». */
export function firstNameOf(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

// ─────────────────────── статистика ───────────────────────

export interface HomeStat {
  label: string;
  value: number;
  icon: LucideIcon;
}

/** Плитки статистики: воркспейсы/артефакты из мок-данных, неделя — демо. */
export const HOME_STATS: HomeStat[] = [
  { label: "Воркспейсов", value: MOCK_WORKSPACES.length, icon: Boxes },
  { label: "Артефактов", value: MOCK_ARTIFACTS.length, icon: Layers },
  { label: "Заметок за неделю", value: 12, icon: NotebookPen },
  { label: "Активных стадий", value: 4, icon: Activity },
];

// ─────────────────────── лента активности ───────────────────────

/** Цветовая тональность события — по типу воркспейса, где оно произошло. */
export type ActivityTone =
  | "film"
  | "book"
  | "music"
  | "app"
  | "universal"
  | "neutral";

export const ACTIVITY_TONE_CLASS: Record<ActivityTone, string> = {
  film: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  book: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  music: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  app: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  universal: "bg-stone-500/15 text-stone-600 dark:text-stone-400",
  neutral: "bg-primary/10 text-primary",
};

export interface HomeActivityItem {
  id: string;
  /** Воркспейс, в котором произошло событие (клик открывает его). */
  workspaceId: string;
  text: string;
  time: string;
  icon: LucideIcon;
  tone: ActivityTone;
}

/** Мок-журнал событий всех модулей (Фаза A — реальная лента из БД). */
export const HOME_ACTIVITY: HomeActivityItem[] = [
  {
    id: "act-1",
    workspaceId: "ws-film-dwinter",
    text: "Сцена 07 — Вьюга смонтирована",
    time: "12 мин назад",
    icon: Clapperboard,
    tone: "film",
  },
  {
    id: "act-2",
    workspaceId: "ws-book-fjord",
    text: "Глава 9. Шторм — 1 240 слов",
    time: "1 ч назад",
    icon: BookOpenText,
    tone: "book",
  },
  {
    id: "act-3",
    workspaceId: "ws-music-moon",
    text: "Вокал — дубль 2 транспонирован на +2",
    time: "3 ч назад",
    icon: AudioWaveform,
    tone: "music",
  },
  {
    id: "act-4",
    workspaceId: "ws-app-landing",
    text: "Сборка v0.3.1 прошла тесты",
    time: "вчера",
    icon: Rocket,
    tone: "app",
  },
  {
    id: "act-5",
    workspaceId: "ws-book-fjord",
    text: "Портрет Эйнара добавлен в альбом",
    time: "вчера",
    icon: UserRound,
    tone: "book",
  },
  {
    id: "act-6",
    workspaceId: "ws-uni-podcast",
    text: "Озвучка интро выпуска №12 готова",
    time: "вчера",
    icon: Mic,
    tone: "universal",
  },
  {
    id: "act-7",
    workspaceId: "ws-music-moon",
    text: "Обложка EP — вариант 3 утверждён",
    time: "2 дня назад",
    icon: ImagePlus,
    tone: "music",
  },
  {
    id: "act-8",
    workspaceId: "ws-app-landing",
    text: "Оркестратор дописал hero-секцию лендинга",
    time: "2 дня назад",
    icon: FileCode2,
    tone: "app",
  },
];
