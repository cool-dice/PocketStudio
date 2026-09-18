"use client";

/**
 * Pipeline card — horizontal 4 steps connected by arrows
 * (vertical stack with rotated arrows on mobile).
 */

import { Fragment } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

import { PIPELINE_STEPS, type StepStatus } from "./deploy-data";
import { cn } from "@/lib/utils";

const ICON_TONE: Record<StepStatus, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

function StepStatusBadge({ status }: { status: StepStatus }) {
  if (status === "done") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="size-3" aria-hidden="true" />
        Готово
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        В процессе
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border bg-stone-500/10 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:text-stone-400">
      Ожидает
    </span>
  );
}

export function PipelineCard({ statuses }: { statuses: StepStatus[] }) {
  const doneCount = statuses.filter((s) => s === "done").length;
  const progress = Math.round((doneCount / PIPELINE_STEPS.length) * 100);

  return (
    <section
      aria-label="Пайплайн релиза"
      className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">Пайплайн релиза</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Сборка → реестр → хост, версия 1.4.2
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
          {doneCount}/{PIPELINE_STEPS.length} шагов
        </span>
      </div>

      {/* общий прогресс */}
      <div
        className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Прогресс деплоя"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <ol className="flex flex-col items-stretch gap-2 sm:flex-row sm:gap-0">
        {PIPELINE_STEPS.map((step, i) => {
          const status = statuses[i] ?? "idle";
          const Icon = step.icon;
          return (
            <Fragment key={step.id}>
              <li
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-2.5 rounded-xl border bg-background/70 p-3.5 transition-colors duration-300",
                  status === "running" && "border-amber-500/40 bg-amber-500/[0.04]",
                  status === "done" && "border-emerald-500/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg transition-colors duration-300",
                      ICON_TONE[status],
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-4.5" />
                  </span>
                  <StepStatusBadge status={status} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{step.title}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                    {step.sub}
                  </p>
                </div>
                <code className="mt-auto w-fit rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {step.chip}
                </code>
              </li>
              {i < PIPELINE_STEPS.length - 1 ? (
                <li
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center py-0.5 sm:px-1"
                >
                  <ArrowRight
                    className={cn(
                      "size-4 rotate-90 transition-colors duration-300 sm:rotate-0",
                      statuses[i + 1] && statuses[i + 1] !== "idle"
                        ? "text-primary"
                        : "text-muted-foreground/50",
                    )}
                  />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}
