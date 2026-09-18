/**
 * Мок-данные проверки канона NarrativeCore: находки-расхождения
 * рукописи с кодексом и таймлайном персонажей.
 * Чистый визуальный слой без запросов.
 */

/* ─────────────────────────── Канон ─────────────────────────── */

export type CanonSeverity = "error" | "warning" | "note";
export type CanonStatus = "new" | "fixed" | "rejected";

export const CANON_SEVERITY_META: Record<
  CanonSeverity,
  { label: string; badgeClassName: string }
> = {
  error: {
    label: "Ошибка",
    badgeClassName: "border-destructive/50 bg-destructive/10 text-destructive",
  },
  warning: {
    label: "Предупреждение",
    badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  note: {
    label: "Заметка",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export interface CanonFinding {
  id: string;
  severity: CanonSeverity;
  message: string;
  chapter: number;
  quote: string;
  hint: string;
}

export const CANON_FINDINGS: CanonFinding[] = [
  {
    id: "cn-1",
    severity: "error",
    message: "В главе 2 глаза Ари были зелёными, в главе 7 — карими.",
    chapter: 7,
    quote:
      "«…Вейра смотрит в глаза сестре — карие, как у матери, только теплее…» — глава 7, сцена у маяка.",
    hint: "Зафиксируйте цвет глаз в карточке персонажа, чтобы ИИ не путался дальше.",
  },
  {
    id: "cn-2",
    severity: "error",
    message: "Стеклянный компас разбит в главе 3, но в главе 6 появляется целым.",
    chapter: 6,
    quote: "«Ари достала компас — стрелка дрожала в трещине…» — глава 6, Исход.",
    hint: "Либо вставьте сцену починки у Хранителей, либо замените предмет в главе 6.",
  },
  {
    id: "cn-3",
    severity: "warning",
    message: "Возраст Вейры: в главе 2 — 23 года, в главе 9 — 19.",
    chapter: 9,
    quote: "«Девятнадцать зим носила она узелок на запястье…» — глава 9, финал Исхода.",
    hint: "Похоже на опечатку — в таймлайне персонажа указан возраст 23.",
  },
  {
    id: "cn-4",
    severity: "warning",
    message: "Мост назван «Слюдяным» в главе 4 и «Стеклянным» в главе 6.",
    chapter: 6,
    quote: "«Стеклянный мост пел под полозьями…» — глава 6, переправа.",
    hint: "Сверьте название локации с кодексом: в карточке — «Слюдяной мост».",
  },
  {
    id: "cn-5",
    severity: "note",
    message: "Имя трактирщицы пишется по-разному: «Стефа» (гл. 2) и «Стефания» (гл. 8).",
    chapter: 8,
    quote: "«Тётушка Стефания выставила всех за дверь…» — глава 8, трактир «Полынья».",
    hint: "Мелочь, но в аудиоверсии это прозвучит как два разных персонажа.",
  },
];

