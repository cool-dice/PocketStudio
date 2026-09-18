import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleDollarSign,
  CreditCard,
  FileText,
  GraduationCap,
  Music2,
  Wallet,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Revenue chart                                                       */
/* ------------------------------------------------------------------ */

export interface RevenueMonth {
  /** Short axis label, e.g. "янв". */
  short: string;
  /** Capitalized tooltip label, e.g. "Янв". */
  tooltip: string;
  /** Bar height in percent (also thousands of rubles). */
  value: number;
  /** Pre-formatted amount for the tooltip. */
  amountLabel: string;
  isCurrent?: boolean;
}

export const REVENUE_MONTHS: RevenueMonth[] = [
  { short: "янв", tooltip: "Янв", value: 18, amountLabel: "18 000 ₽" },
  { short: "фев", tooltip: "Фев", value: 22, amountLabel: "22 000 ₽" },
  { short: "мар", tooltip: "Мар", value: 26, amountLabel: "26 000 ₽" },
  { short: "апр", tooltip: "Апр", value: 31, amountLabel: "31 000 ₽" },
  { short: "май", tooltip: "Май", value: 29, amountLabel: "29 000 ₽" },
  { short: "июн", tooltip: "Июн", value: 38, amountLabel: "38 000 ₽" },
  { short: "июл", tooltip: "Июл", value: 44, amountLabel: "44 000 ₽" },
  { short: "авг", tooltip: "Авг", value: 41, amountLabel: "41 000 ₽" },
  { short: "сен", tooltip: "Сен", value: 52, amountLabel: "52 000 ₽" },
  { short: "окт", tooltip: "Окт", value: 61, amountLabel: "61 000 ₽" },
  { short: "ноя", tooltip: "Ноя", value: 74, amountLabel: "74 000 ₽" },
  { short: "дек", tooltip: "Дек", value: 82, amountLabel: "82 000 ₽", isCurrent: true },
];

/* ------------------------------------------------------------------ */
/* Publications (portfolio)                                           */
/* ------------------------------------------------------------------ */

export type PublicationStatus = "published" | "draft" | "preparing";

export const PUBLICATION_STATUS_META: Record<
  PublicationStatus,
  { label: string; className: string }
> = {
  published: {
    label: "Опубликовано",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  draft: {
    label: "Черновик",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  preparing: {
    label: "В подготовке",
    className:
      "border-stone-400/40 bg-stone-400/10 text-stone-600 dark:text-stone-400",
  },
};

export interface Publication {
  id: string;
  title: string;
  /** Human-readable work type, e.g. "Книга". */
  type: string;
  platform: "Ritm" | "Boosty" | "Gumroad";
  /** Pre-formatted price or null while unpublished. */
  price: string | null;
  /** Sales / reads metric shown under the title. */
  metric: string;
  status: PublicationStatus;
  icon: LucideIcon;
}

export const PUBLICATIONS: Publication[] = [
  {
    id: "pixel-constellation",
    title: "Созвездие Пикселя",
    type: "Книга",
    platform: "Ritm",
    price: "590 ₽",
    metric: "412 продаж",
    status: "published",
    icon: BookOpen,
  },
  {
    id: "pocket-studio-article",
    title: "Как я построил студию в кармане",
    type: "Статья",
    platform: "Boosty",
    price: "150 ₽",
    metric: "8 312 прочтений",
    status: "published",
    icon: FileText,
  },
  {
    id: "lofi-chapters",
    title: "Лоу-фай для написания глав",
    type: "Трек",
    platform: "Gumroad",
    price: "199 ₽",
    metric: "ждёт публикации",
    status: "draft",
    icon: Music2,
  },
  {
    id: "pocket-cinema-course",
    title: "Курс: Кино в кармане",
    type: "Курс",
    platform: "Boosty",
    price: null,
    metric: "материалы готовятся",
    status: "preparing",
    icon: GraduationCap,
  },
];

/* ------------------------------------------------------------------ */
/* Payout methods                                                     */
/* ------------------------------------------------------------------ */

export interface PayoutMethod {
  id: string;
  name: string;
  icon: LucideIcon;
  isDefault?: boolean;
}

export const PAYOUT_METHODS: PayoutMethod[] = [
  { id: "card", name: "Карта •• 4821", icon: CreditCard, isDefault: true },
  { id: "yumoney", name: "ЮMoney", icon: Wallet },
  { id: "usdt", name: "USDT (TRC-20)", icon: CircleDollarSign },
];
