import type { FindingSeverity, FindingStatus, FindingType } from "@/lib/workspace-types";

/**
 * Аналитик (Фаза A): находки приходят из REST API (FindingDto),
 * здесь — только меты типов, серьёзности и статусов для UI.
 *
 * Серьёзность: critical = rose, warning = amber, info = sky.
 * Типы: contradiction / omission / inconsistency.
 */

export type { FindingSeverity, FindingStatus, FindingType };

export const FINDING_TYPE_META: Record<
  FindingType,
  { label: string; plural: string; badgeClassName: string }
> = {
  contradiction: {
    label: "Противоречие",
    plural: "Противоречия",
    badgeClassName: "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  omission: {
    label: "Недосказанность",
    plural: "Недосказанности",
    badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  inconsistency: {
    label: "Расхождение",
    plural: "Расхождения",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export const FINDING_SEVERITY_META: Record<
  FindingSeverity,
  { label: string; badgeClassName: string }
> = {
  critical: {
    label: "Критично",
    badgeClassName: "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  warning: {
    label: "Внимание",
    badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  info: {
    label: "Заметка",
    badgeClassName: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
};

export const FINDING_STATUS_META: Record<
  FindingStatus,
  { label: string; badgeClassName: string }
> = {
  open: {
    label: "открыта",
    badgeClassName: "border-primary/40 bg-primary/10 text-primary",
  },
  fixed: {
    label: "исправлено",
    badgeClassName:
      "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  dismissed: {
    label: "отклонена",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

/** Порядок чипов фильтра по типу. */
export const FINDING_TYPE_FILTERS: FindingType[] = [
  "contradiction",
  "omission",
  "inconsistency",
];

export function findingTypeMeta(type: string): { label: string; plural: string } {
  return FINDING_TYPE_META[type as FindingType] ?? FINDING_TYPE_META.inconsistency;
}
