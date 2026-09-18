import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Clapperboard,
  FileText,
  Newspaper,
} from "lucide-react";

import type { DocumentDto, DocumentKind } from "@/lib/workspace-types";

/**
 * Общие утилиты модуля «Документы» (Фаза A): форматирование чисел,
 * русская плюрализация, меты видов документов из DTO и «N мин назад»
 * для ISO-дат из API. Моки удалены — источник данных REST API.
 */

/* ─────────────────────────── Форматирование ─────────────────────────── */

/** 19044 → «19 044» (разряды разделены по правилам ru-RU). */
export function formatNumber(value: number): string {
  return value.toLocaleString("ru-RU");
}

/** Русская плюрализация: pluralRu(5, "документ", "документа", "документов"). */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Слова: «слово / слова / слов» с учётом числа. */
export function wordsLabel(n: number): string {
  return `${formatNumber(n)} ${pluralRu(n, "слово", "слова", "слов")}`;
}

/** Знаки: «знак / знака / знаков» с учётом числа. */
export function charsLabel(n: number): string {
  return `${formatNumber(n)} ${pluralRu(n, "знак", "знака", "знаков")}`;
}

/** «N мин / N ч / N дн назад» для ISO-строки из API. */
export function agoFromISO(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "только что";
  if (minutes < 60) {
    return `${formatNumber(minutes)} ${pluralRu(minutes, "минуту", "минуты", "минут")} назад`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${formatNumber(hours)} ${pluralRu(hours, "час", "часа", "часов")} назад`;
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${formatNumber(days)} ${pluralRu(days, "день", "дня", "дней")} назад`;
  }
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

/* ─────────────────────────── Виды документов ─────────────────────────── */

export const DOC_KIND_META: Record<
  DocumentKind,
  { label: string; plural: string; icon: LucideIcon }
> = {
  manuscript: { label: "Рукопись", plural: "Рукописи", icon: BookOpenText },
  spec: { label: "Спека", plural: "Спеки", icon: FileText },
  article: { label: "Статья", plural: "Статьи", icon: Newspaper },
  script: { label: "Сценарий", plural: "Сценарии", icon: Clapperboard },
};

/** Порядок чипов фильтра библиотеки. */
export const DOC_KIND_FILTERS: DocumentKind[] = ["manuscript", "spec", "article", "script"];

export function docKindMeta(kind: string): { label: string; plural: string; icon: LucideIcon } {
  return DOC_KIND_META[kind as DocumentKind] ?? DOC_KIND_META.manuscript;
}

/* ─────────────────────────── Секции документа ─────────────────────────── */

export type SectionStatus = "draft" | "done";

export const SECTION_STATUS_META: Record<
  SectionStatus,
  { label: string; toggleTo: string; className: string }
> = {
  draft: {
    label: "Черновик",
    toggleTo: "Пометить готовой",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  done: {
    label: "Готово",
    toggleTo: "Вернуть в черновики",
    className: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
};

/** Готовность документа: доля готовых секций (0–100). */
export function docProgress(doc: DocumentDto): number {
  const sections = doc.sections ?? [];
  if (sections.length === 0) return doc.wordsCount > 0 ? 100 : 0;
  const done = sections.filter((s) => s.status === "done").length;
  return Math.round((done / sections.length) * 100);
}
