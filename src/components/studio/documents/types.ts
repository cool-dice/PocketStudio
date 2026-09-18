import type { LucideIcon } from "lucide-react";
import { BookOpenText, Clapperboard, Newspaper } from "lucide-react";

/**
 * Доменные типы и мок-данные экрана «Документы».
 * Чистый визуальный слой: никаких запросов, только локальное состояние.
 */

export type DocKind = "book" | "article" | "script";

export type DocStatus = "draft" | "writing" | "done" | "published";

export type ChapterStatus = "done" | "current" | "pending";

export interface Chapter {
  id: string;
  number: number;
  title: string;
  status: ChapterStatus;
  words: number;
}

export interface StudioDoc {
  id: string;
  title: string;
  kind: DocKind;
  status: DocStatus;
  /** Всего слов в документе (сумма глав для книг). */
  words: number;
  /** Готовность в процентах, 0–100. */
  progress: number;
  chapters?: Chapter[];
}

export const KIND_META: Record<DocKind, { label: string; plural: string; icon: LucideIcon }> = {
  book: { label: "Книга", plural: "Книги", icon: BookOpenText },
  article: { label: "Статья", plural: "Статьи", icon: Newspaper },
  script: { label: "Сценарий", plural: "Сценарии", icon: Clapperboard },
};

export const STATUS_META: Record<DocStatus, { label: string; className: string; dotClassName: string }> = {
  draft: {
    label: "Черновик",
    className: "border-border bg-muted text-muted-foreground",
    dotClassName: "bg-muted-foreground/40",
  },
  writing: {
    label: "В работе",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dotClassName: "bg-amber-500",
  },
  done: {
    label: "Готово",
    className: "border-primary/30 bg-primary/10 text-primary",
    dotClassName: "bg-primary/60",
  },
  published: {
    label: "Опубликовано",
    className: "border-primary/40 bg-primary/15 text-primary",
    dotClassName: "bg-primary",
  },
};

export const MOCK_DOCS: StudioDoc[] = [
  {
    id: "sozvezdie-pikselya",
    title: "Созвездие Пикселя",
    kind: "book",
    status: "writing",
    words: 19044,
    progress: 64,
    chapters: [
      { id: "sp-1", number: 1, title: "Всё началось с кассеты", status: "done", words: 4680 },
      { id: "sp-2", number: 2, title: "Тетрадь в клеточку", status: "done", words: 5240 },
      { id: "sp-3", number: 3, title: "Космос в жестяной банке", status: "done", words: 4910 },
      {
        id: "sp-4",
        number: 4,
        title: "Карман, в котором помещается киностудия",
        status: "current",
        words: 4214,
      },
      { id: "sp-5", number: 5, title: "Оркестратор и его антураж", status: "pending", words: 0 },
      { id: "sp-6", number: 6, title: "Ритмы города", status: "pending", words: 0 },
      { id: "sp-7", number: 7, title: "Первый контакт", status: "pending", words: 0 },
      { id: "sp-8", number: 8, title: "Монетизация по-карманному", status: "pending", words: 0 },
      { id: "sp-9", number: 9, title: "Команда из одного", status: "pending", words: 0 },
      { id: "sp-10", number: 10, title: "Тишина перед релизом", status: "pending", words: 0 },
      { id: "sp-11", number: 11, title: "Премьера на девяти экранах", status: "pending", words: 0 },
      { id: "sp-12", number: 12, title: "Эпилог. Созвездие Пикселя", status: "pending", words: 0 },
    ],
  },
  {
    id: "kak-ya-postroil-studiyu",
    title: "Как я построил студию в кармане",
    kind: "article",
    status: "done",
    words: 6480,
    progress: 100,
  },
  {
    id: "scenariy-pervyy-kontakt",
    title: "Сценарий: Первый контакт",
    kind: "script",
    status: "draft",
    words: 3120,
    progress: 12,
  },
  {
    id: "ritmy-goroda",
    title: "Ритмы города",
    kind: "book",
    status: "published",
    words: 7380,
    progress: 31,
    chapters: [
      { id: "rg-1", number: 1, title: "Мост в шесть утра", status: "done", words: 2940 },
      { id: "rg-2", number: 2, title: "Трамвай «Пульс»", status: "done", words: 2610 },
      { id: "rg-3", number: 3, title: "Подземный переход", status: "current", words: 1830 },
      { id: "rg-4", number: 4, title: "Финальный аккорд", status: "pending", words: 0 },
    ],
  },
  {
    id: "gayd-po-orkestratoru",
    title: "Гайд по оркестратору",
    kind: "article",
    status: "writing",
    words: 5760,
    progress: 78,
  },
];

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
