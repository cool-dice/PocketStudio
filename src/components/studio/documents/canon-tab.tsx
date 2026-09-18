"use client";

/**
 * Вкладка «Канон»: проверка консистентности мира. Кнопка запускает
 * мок-пайплайн (чтение → сверка → отчёт) с прогрессом, затем
 * показываются находки: серьёзность, источник-глава с цитатой,
 * статусы «новое / исправлено / отклонено».
 */

import { Check, Circle, Loader2, ScanSearch, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { WipBadge } from "./codex-entity-sheet";
import {
  CANON_FINDINGS,
  CANON_SEVERITY_META,
  type CanonSeverity,
  type CanonStatus,
} from "./canon-data";

type CheckPhase = "idle" | "reading" | "matching" | "reporting" | "done";

const CHECK_STEPS: { phase: Exclude<CheckPhase, "idle" | "done">; label: string }[] = [
  { phase: "reading", label: "Чтение рукописи…" },
  { phase: "matching", label: "Сверка сущностей…" },
  { phase: "reporting", label: "Формирование отчёта…" },
];

const STATUS_META: Record<CanonStatus, { label: string; className: string }> = {
  new: {
    label: "новое",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  fixed: {
    label: "исправлено",
    className: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  rejected: {
    label: "отклонено",
    className: "border-border bg-muted text-muted-foreground",
  },
};

export function CanonTab() {
  const [phase, setPhase] = useState<CheckPhase>("idle");
  const [statuses, setStatuses] = useState<Record<string, CanonStatus>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  function runCheck() {
    if (phase !== "idle" && phase !== "done") return;
    setStatuses({});
    setExpandedId(null);
    setPhase("reading");
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [
      window.setTimeout(() => setPhase("matching"), 1100),
      window.setTimeout(() => setPhase("reporting"), 2200),
      window.setTimeout(() => {
        setPhase("done");
        toast.success("Канон проверен", {
          description: `Найдено ${CANON_FINDINGS.length} расхождений — смотрите отчёт ниже.`,
        });
      }, 3100),
    ];
  }

  function setStatus(id: string, status: CanonStatus) {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  }

  const counts = {
    total: CANON_FINDINGS.length,
    error: CANON_FINDINGS.filter((f) => f.severity === "error").length,
    warning: CANON_FINDINGS.filter((f) => f.severity === "warning").length,
    note: CANON_FINDINGS.filter((f) => f.severity === "note").length,
  };
  const activeStepIndex = CHECK_STEPS.findIndex((step) => step.phase === phase);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Заголовок проверки */}
      <div className="shrink-0 border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <ShieldCheck className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Канон романа</h3>
            <p className="text-xs text-muted-foreground">
              Сверяет рукопись с кодексом и таймлайном персонажей
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {phase !== "idle" && phase !== "done" ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
                {CHECK_STEPS[activeStepIndex]?.label}
              </span>
            ) : null}
            <Button type="button" onClick={runCheck} disabled={phase !== "idle" && phase !== "done"}>
              {phase === "done" ? (
                <>
                  <ScanSearch className="size-4" aria-hidden="true" />
                  Проверить снова
                </>
              ) : phase !== "idle" ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Проверка идёт…
                </>
              ) : (
                <>
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  Проверить канон
                </>
              )}
            </Button>
            <WipBadge />
          </div>
        </div>

        {/* Прогресс пайплайна */}
        {phase !== "idle" ? (
          <div className="mt-4 space-y-2.5">
            <Progress
              value={phase === "done" ? 100 : Math.max(8, (activeStepIndex / CHECK_STEPS.length) * 100)}
              aria-label="Прогресс проверки канона"
            />
            <ol className="grid gap-1.5 sm:grid-cols-3" aria-label="Шаги проверки">
              {CHECK_STEPS.map((step, index) => {
                const isDone = phase === "done" || index < activeStepIndex;
                const isActive = step.phase === phase;
                return (
                  <li
                    key={step.phase}
                    aria-current={isActive ? "step" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                      isDone
                        ? "border-primary/30 bg-primary/[0.06] text-foreground"
                        : isActive
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground/70",
                    )}
                  >
                    {isDone ? (
                      <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    ) : isActive ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                    ) : (
                      <Circle className="size-3 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : null}
      </div>

      {/* Тело: пустое состояние или отчёт */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {phase === "idle" ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span
              className="flex size-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <ScanSearch className="size-6" />
            </span>
            <div>
              <p className="text-sm font-medium">Канон ещё не проверялся</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Проверка сравнит «Хроники Долгой Зимы» с записями кодекса и таймлайном
                персонажей: цвета глаз, возрасты, названия локаций и судьбы предметов.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Сводка */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Сводка находок">
              <SummaryTile label="Всего" value={counts.total} tone="neutral" />
              <SummaryTile label="Ошибки" value={counts.error} tone="destructive" />
              <SummaryTile label="Предупреждения" value={counts.warning} tone="amber" />
              <SummaryTile label="Заметки" value={counts.note} tone="muted" />
            </div>

            {/* Список находок */}
            <ul className="space-y-2.5" aria-label="Находки проверки канона">
              {CANON_FINDINGS.map((finding) => (
                <CanonFindingRow
                  key={finding.id}
                  finding={finding}
                  status={statuses[finding.id] ?? "new"}
                  expanded={expandedId === finding.id}
                  onToggleQuote={() => setExpandedId((prev) => (prev === finding.id ? null : finding.id))}
                  onSetStatus={(status) => setStatus(finding.id, status)}
                />
              ))}
            </ul>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Проверка запускается вручную и не переписывает текст: исправления вносятся
              вами в рукописи, после чего находку можно отметить исправленной.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "destructive" | "amber" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card px-3.5 py-3",
        tone === "neutral" && "border-border",
        tone === "destructive" && "border-destructive/40",
        tone === "amber" && "border-amber-500/40",
        tone === "muted" && "border-border bg-muted/40",
      )}
    >
      <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p
        className={cn(
          "mt-1.5 text-[11px] font-medium",
          tone === "destructive" && "text-destructive",
          tone === "amber" && "text-amber-700 dark:text-amber-400",
          (tone === "neutral" || tone === "muted") && "text-muted-foreground",
        )}
      >
        {label}
      </p>
    </div>
  );
}

function CanonFindingRow({
  finding,
  status,
  expanded,
  onToggleQuote,
  onSetStatus,
}: {
  finding: (typeof CANON_FINDINGS)[number];
  status: CanonStatus;
  expanded: boolean;
  onToggleQuote: () => void;
  onSetStatus: (status: CanonStatus) => void;
}) {
  const severity = CANON_SEVERITY_META[finding.severity];

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
            severity.badgeClassName,
          )}
        >
          {severity.label}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug">{finding.message}</p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          гл. {finding.chapter}
        </span>
        <button
          type="button"
          onClick={onToggleQuote}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
        >
          Показать
        </button>

        <span
          className={cn(
            "ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
            STATUS_META[status].className,
          )}
        >
          {STATUS_META[status].label}
        </span>

        {status === "new" ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onSetStatus("fixed")}
              title="Отметить исправленным"
              aria-label={`Находка «${finding.message}» исправлена`}
              className="flex size-6 items-center justify-center rounded-md border border-emerald-600/40 bg-emerald-600/10 text-emerald-700 transition-colors hover:bg-emerald-600/20 dark:text-emerald-400"
            >
              <Check className="size-3" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onSetStatus("rejected")}
              title="Отклонить находку"
              aria-label={`Отклонить находку «${finding.message}»`}
              className="flex size-6 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2 rounded-lg border bg-muted/40 p-3">
          <p className="border-l-2 border-primary/50 pl-3 font-serif text-[13px] italic leading-relaxed text-foreground/85">
            {finding.quote}
          </p>
          <p className="pl-3 text-[11px] leading-relaxed text-muted-foreground">
            Совет: {finding.hint}
          </p>
        </div>
      ) : null}
    </li>
  );
}
