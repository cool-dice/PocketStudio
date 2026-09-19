"use client";

import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FindingDto, FindingStatus } from "@/lib/workspace-types";
import {
  FINDING_SEVERITY_META,
  FINDING_STATUS_META,
  FINDING_TYPE_META,
} from "./analyst-data";

export function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "rose" | "amber" | "sky";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-3.5 py-3",
        tone === "rose" && "border-rose-500/40",
        tone === "amber" && "border-amber-500/40",
        tone === "sky" && "border-sky-500/40",
      )}
    >
      <p className="text-2xl font-semibold leading-none tabular-nums">{value}</p>
      <p
        className={cn(
          "mt-1.5 text-[11px] font-medium text-muted-foreground",
          tone === "rose" && "text-rose-600 dark:text-rose-400",
          tone === "amber" && "text-amber-700 dark:text-amber-400",
          tone === "sky" && "text-sky-600 dark:text-sky-400",
        )}
      >
        {label}
      </p>
    </div>
  );
}

export function FindingCard({
  finding,
  expanded,
  onToggleQuote,
  onSetStatus,
}: {
  finding: FindingDto;
  expanded: boolean;
  onToggleQuote: () => void;
  onSetStatus: (status: FindingStatus) => void;
}) {
  const typeMeta = FINDING_TYPE_META[finding.type];
  const severityMeta = FINDING_SEVERITY_META[finding.severity];
  const statusMeta = FINDING_STATUS_META[finding.status];

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            typeMeta.badgeClassName,
          )}
        >
          {typeMeta.label}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            severityMeta.badgeClassName,
          )}
        >
          {severityMeta.label}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug">{finding.title}</p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {finding.sourceRef ? (
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            {finding.sourceRef}
          </span>
        ) : null}
        {finding.quote ? (
          <button
            type="button"
            onClick={onToggleQuote}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <ChevronDown
              className={cn("size-3 transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
            Показать
          </button>
        ) : null}

        <span
          className={cn(
            "ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
            statusMeta.badgeClassName,
          )}
        >
          {statusMeta.label}
        </span>

        {finding.status === "open" ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSetStatus("fixed")}
              title="Отметить исправленной"
              aria-label={`Находка «${finding.title}» исправлена`}
              className="flex size-6 items-center justify-center rounded-md border border-emerald-600/40 bg-emerald-600/10 text-emerald-700 transition-colors hover:bg-emerald-600/20 dark:text-emerald-400"
            >
              <Check className="size-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onSetStatus("dismissed")}
              title="Отклонить находку"
              aria-label={`Отклонить находку «${finding.title}»`}
              className="flex size-6 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2 rounded-lg border bg-muted/40 p-3">
          {finding.quote ? (
            <p className="border-l-2 border-primary/50 pl-3 text-[13px] italic leading-relaxed text-foreground/85">
              {finding.quote}
            </p>
          ) : null}
          {finding.advice ? (
            <p className="pl-3 text-[11px] leading-relaxed text-muted-foreground">
              Совет: {finding.advice}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
