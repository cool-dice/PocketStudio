"use client";

import { Fragment } from "react";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import { ACTIVE_STEP, PIPELINE_STEPS } from "./video-data";

/**
 * Horizontal production pipeline: Сценарий → Раскадровка → Кадры →
 * Озвучка → Монтаж. Steps before ACTIVE_STEP are done (emerald check),
 * the active one pulses, the rest are pending. Clicking a step selects it
 * (pure visual state owned by the parent).
 */
export function PipelineStepper({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (index: number) => void;
}) {
  const last = PIPELINE_STEPS.length - 1;

  return (
    <ol
      aria-label="Этапы производства видео"
      className="flex w-full items-start"
    >
      {PIPELINE_STEPS.map((step, i) => {
        const done = i < ACTIVE_STEP;
        const active = i === ACTIVE_STEP;
        const isSelected = i === selected;
        const Icon = step.icon;
        const caption = done
          ? "готово"
          : active
            ? "в работе"
            : "ожидает";

        return (
          <Fragment key={step.id}>
            <li className="flex min-w-0 flex-1 flex-col items-center">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isSelected ? "step" : undefined}
                className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl px-1 py-0.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span
                  className={cn(
                    "relative flex size-9 items-center justify-center rounded-full border-2 transition-colors",
                    done && "border-primary/60 bg-primary/10 text-primary",
                    active && "border-primary bg-primary/10 text-primary",
                    !done &&
                      !active &&
                      "border-border bg-muted/50 text-muted-foreground group-hover:border-muted-foreground/40",
                    isSelected &&
                      "ring-2 ring-ring/60 ring-offset-2 ring-offset-background",
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 animate-ping rounded-full bg-primary/25"
                    />
                  ) : null}
                  {done ? (
                    <Check className="relative size-4" aria-hidden="true" />
                  ) : (
                    <Icon className="relative size-4" aria-hidden="true" />
                  )}
                </span>
                <span
                  className={cn(
                    "w-full truncate text-center text-[11px] leading-tight sm:text-xs",
                    isSelected
                      ? "font-semibold text-foreground"
                      : done
                        ? "text-foreground/80"
                        : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
                <span
                  className={cn(
                    "hidden text-[10px] leading-none sm:block",
                    done && "text-emerald-600 dark:text-emerald-400",
                    active && "font-medium text-primary",
                    !done && !active && "text-muted-foreground/70",
                  )}
                  aria-hidden="true"
                >
                  {caption}
                </span>
              </button>
            </li>
            {i < last ? (
              <li
                aria-hidden="true"
                className={cn(
                  "mt-[17px] hidden h-0.5 w-8 shrink-0 rounded-full sm:block",
                  i < ACTIVE_STEP ? "bg-primary/50" : "bg-border",
                )}
              />
            ) : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
