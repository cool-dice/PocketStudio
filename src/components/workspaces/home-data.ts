/**
 * Главная — данные дашборда (Фаза A): живая статистика из /api/dashboard,
 * иконки ленты активности по типу артефакта, tone-палитра событий и
 * утилиты приветствия (дата, имя, человекочитаемая разница timeAgo).
 */

import {
  Activity,
  AudioWaveform,
  BookOpenText,
  Boxes,
  Clapperboard,
  FileCode2,
  FolderKanban,
  ImagePlus,
  Layers,
  Lightbulb,
  Music4,
  NotebookPen,
  Palette,
  Rocket,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { pluralRu } from "@/components/workspaces/overview-data";
import type { DashboardDto } from "@/lib/workspace-types";

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

// ─────────────────────── timeAgo ───────────────────────

/**
 * Человекочитаемая разница от ISO-даты: «только что», «12 мин назад»,
 * «3 ч назад», «вчера», «2 дня назад», дальше — «14 сентября».
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) {
    return `${days} ${pluralRu(days, "день", "дня", "дней")} назад`;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
  }).format(date);
}

// ─────────────────────── статистика ───────────────────────

export interface HomeStat {
  label: string;
  value: number;
  icon: LucideIcon;
}

/** Плитки «Студия в цифрах» из живых счётчиков /api/dashboard. */
export function homeStats(stats: DashboardDto["stats"]): HomeStat[] {
  return [
    { label: "Воркспейсов", value: stats.workspaces, icon: Boxes },
    { label: "Артефактов", value: stats.artifacts, icon: Layers },
    { label: "Заметок за неделю", value: stats.notesWeek, icon: NotebookPen },
    { label: "Активных стадий", value: stats.activeStages, icon: Activity },
  ];
}

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

/** Иконка события по типу артефакта (в БД встречаются и album-виды). */
const ACTIVITY_TYPE_ICONS: Record<string, LucideIcon> = {
  note: NotebookPen,
  document: BookOpenText,
  portrait: UserRound,
  image: ImagePlus,
  track: Music4,
  audio: AudioWaveform,
  scene: Clapperboard,
  video: Clapperboard,
  app: FileCode2,
  deploy: Rocket,
  file: FolderKanban,
  concept: Lightbulb,
  illustration: Palette,
  workspace: Boxes,
};

/** Иконка события: известный тип артефакта или дежурная «искра». */
export function activityIconOf(type: string): LucideIcon {
  return ACTIVITY_TYPE_ICONS[type] ?? Sparkles;
}
