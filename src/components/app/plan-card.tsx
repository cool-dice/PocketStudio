"use client";

/**
 * PlanCard — live plan checklist pinned above the composer (Stage 4c).
 * Backed by Task rows: the planner/plan-mode agent creates them, the coder
 * checks them off via complete_task and "tasks:updated" WS pushes stream in.
 * Collapsible; progress bar + per-task check animation; the next pending
 * step gets a pulsing "current" hint while the agent is busy.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ListChecks,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";

import type { Task, TurnPhase } from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASE_META: Record<
  Exclude<TurnPhase, "idle">,
  { icon: LucideIcon; label: string; hint: string }
> = {
  plan: {
    icon: ListChecks,
    label: "Планировщик",
    hint: "составляет шаги",
  },
  act: {
    icon: ListChecks,
    label: "Исполнитель",
    hint: "работает по плану",
  },
  review: {
    icon: Check,
    label: "Ревьюер",
    hint: "проверяет результат",
  },
};

function pluralStepsRu(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "шаг";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "шага";
  return "шагов";
}

export function PlanCard({
  tasks,
  busy,
  phase,
}: {
  tasks: Task[];
  busy: boolean;
  phase: { phase: TurnPhase; label: string | null } | null;
}) {
  const [collapsed, setCollapsed] = useState(false);

  // Auto-collapse once everything is done (celebration stays in the header).
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const allDone = total > 0 && done === total;

  useEffect(() => {
    if (allDone) {
      const t = setTimeout(() => setCollapsed(true), 1600);
      return () => clearTimeout(t);
    }
  }, [allDone]);

  if (total === 0) return null;

  const percent = Math.round((done / total) * 100);
  const currentIdx = tasks.findIndex((t) => !t.done);
  const phaseMeta = phase ? PHASE_META[phase.phase] : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-2">
      <motion.section
        aria-label={`План работ: ${done} из ${total} шагов выполнено`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={cn(
          "overflow-hidden rounded-2xl border shadow-sm",
          allDone
            ? "border-emerald-500/40 bg-emerald-500/[0.07]"
            : "border-border/80 bg-card",
        )}
      >
        {/* ── Header ── */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left outline-none transition-colors duration-150 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/60 sm:px-4"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg",
              allDone
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-primary/10 text-primary",
            )}
          >
            {allDone ? (
              <PartyPopper className="size-3.5" />
            ) : (
              <ListChecks className="size-3.5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              <span className="text-[13px] font-semibold leading-tight">
                {allDone ? "План выполнен" : "План работ"}
              </span>
              {!allDone && (
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {done}/{total}
                </span>
              )}
              {busy && phaseMeta && (
                <motion.span
                  key={phaseMeta.label}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="hidden truncate text-[11px] font-medium text-primary/90 sm:inline"
                >
                  {phaseMeta.label} {phaseMeta.hint}…
                </motion.span>
              )}
            </span>
            {/* Progress bar */}
            <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <motion.span
                className={cn(
                  "block h-full rounded-full",
                  allDone
                    ? "bg-emerald-500"
                    : "bg-gradient-to-r from-primary/80 to-primary",
                )}
                initial={false}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              collapsed && "-rotate-90",
            )}
          />
        </button>

        {/* ── Task rows ── */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.ol
              key="rows"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="vf-scroll max-h-72 overflow-y-auto border-t border-border/60 px-3 py-2 sm:px-4"
            >
              {tasks.map((task, i) => {
                const isCurrent = busy && !task.done && i === currentIdx;
                return (
                  <li
                    key={task.id}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150",
                      isCurrent && "bg-primary/[0.06]",
                    )}
                  >
                    <span className="relative mt-0.5 flex size-4.5 shrink-0 items-center justify-center">
                      {task.done ? (
                        <motion.span
                          initial={{ scale: 0.4, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 22,
                          }}
                          className="flex size-4.5 items-center justify-center rounded-full bg-emerald-500 text-white"
                          aria-hidden="true"
                        >
                          <Check className="size-3" strokeWidth={3} />
                        </motion.span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex size-4.5 items-center justify-center rounded-full border-[1.5px] text-[9px] font-semibold tabular-nums",
                            isCurrent
                              ? "border-primary/60 text-primary"
                              : "border-muted-foreground/40 text-muted-foreground/70",
                          )}
                        >
                          {i + 1}
                        </span>
                      )}
                      {isCurrent && (
                        <motion.span
                          className="absolute inset-0 rounded-full border-[1.5px] border-primary/50"
                          animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
                          transition={{
                            duration: 1.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-[13px] leading-relaxed",
                        task.done
                          ? "text-muted-foreground/70 line-through decoration-muted-foreground/40"
                          : isCurrent
                            ? "font-medium text-foreground"
                            : "text-foreground/90",
                      )}
                    >
                      {task.text}
                    </span>
                  </li>
                );
              })}
            </motion.ol>
          )}
        </AnimatePresence>
      </motion.section>
    </div>
  );
}
