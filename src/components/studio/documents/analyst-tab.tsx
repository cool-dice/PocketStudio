"use client";

/**
 * Вкладка «Аналитик»: поиск противоречий, недосказанности и
 * расхождений в документе. Область переключается — рукопись
 * («Хроники Долгой Зимы») или документация («Спека PocketStudio»);
 * проверка не наследуется. Кнопка запускает мок-пайплайн (чтение →
 * сверка → отчёт) с прогрессом, затем показываются находки: тип,
 * серьёзность, источник, цитата, совет и статусы «новое /
 * исправлено / отклонено».
 */

import { Check, Circle, Loader2, ScanSearch, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { WipBadge } from "./entity-sheet";
import { SelectableChip } from "./narrative-chip";
import { pluralRu } from "./types";
import {
  ANALYST_FINDINGS,
  ANALYST_SEVERITY_META,
  ANALYST_TYPE_META,
  type AnalystFinding,
  type AnalystFindingType,
} from "./analyst-data";
import type { EntityDomain } from "./entities-data";

type CheckPhase = "idle" | "reading" | "matching" | "reporting" | "done";
type AnalystStatus = "new" | "fixed" | "rejected";

const CHECK_STEPS: { phase: Exclude<CheckPhase, "idle" | "done">; label: string }[] = [
  { phase: "reading", label: "Чтение текста…" },
  { phase: "matching", label: "Сверка с сущностями…" },
  { phase: "reporting", label: "Отчёт…" },
];

const DOMAIN_FILTERS: { id: EntityDomain; label: string }[] = [
  { id: "narrative", label: "Рукопись · Хроники" },
  { id: "product", label: "Документация · Спека" },
];

const TYPE_FILTERS: { id: AnalystFindingType | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "contradiction", label: "Противоречия" },
  { id: "gap", label: "Недосказанности" },
  { id: "mismatch", label: "Расхождения" },
];

const STATUS_META: Record<AnalystStatus, { label: string; className: string }> = {
  new: { label: "новое", className: "border-primary/40 bg-primary/10 text-primary" },
  fixed: {
    label: "исправлено",
    className: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  rejected: { label: "отклонено", className: "border-border bg-muted text-muted-foreground" },
};

export function AnalystTab() {
  const [domain, setDomain] = useState<EntityDomain>("narrative");
  const [phase, setPhase] = useState<CheckPhase>("idle");
  const [typeFilter, setTypeFilter] = useState<AnalystFindingType | "all">("all");
  const [statuses, setStatuses] = useState<Record<string, AnalystStatus>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);

  useEffect(
    () => () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  const domainFindings = useMemo(
    () => ANALYST_FINDINGS.filter((finding) => finding.domain === domain),
    [domain],
  );

  /** Смена области: проверка не наследуется — сбрасываем всё. */
  function switchDomain(next: EntityDomain) {
    if (next === domain) return;
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    setDomain(next);
    setPhase("idle");
    setTypeFilter("all");
    setStatuses({});
    setExpandedId(null);
  }

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
        toast.success("Аналитик закончил", {
          description: `Найдено ${domainFindings.length} ${pluralRu(domainFindings.length, "находка", "находки", "находок")} — смотрите отчёт ниже.`,
        });
      }, 3100),
    ];
  }

  const counts = {
    total: domainFindings.length,
    error: domainFindings.filter((finding) => finding.severity === "error").length,
    warning: domainFindings.filter((finding) => finding.severity === "warning").length,
    note: domainFindings.filter((finding) => finding.severity === "note").length,
  };
  const typeCounts: Record<AnalystFindingType | "all", number> = {
    all: domainFindings.length,
    contradiction: domainFindings.filter((finding) => finding.type === "contradiction").length,
    gap: domainFindings.filter((finding) => finding.type === "gap").length,
    mismatch: domainFindings.filter((finding) => finding.type === "mismatch").length,
  };
  const visibleFindings =
    typeFilter === "all"
      ? domainFindings
      : domainFindings.filter((finding) => finding.type === typeFilter);
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
            <ScanSearch className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Аналитик</h3>
            <p className="text-xs text-muted-foreground">
              Противоречия, недосказанность и расхождения — для книг, документации и статей
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
                  <ScanSearch className="size-4" aria-hidden="true" />
                  Проверить документ
                </>
              )}
            </Button>
            <WipBadge />
          </div>
        </div>

        {/* Переключатель области */}
        <div
          className="vf-scroll-x mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5"
          role="group"
          aria-label="Область проверки"
        >
          {DOMAIN_FILTERS.map((filter) => (
            <SelectableChip
              key={filter.id}
              label={filter.label}
              selected={domain === filter.id}
              onClick={() => switchDomain(filter.id)}
            />
          ))}
        </div>

        {/* Прогресс пайплайна */}
        {phase !== "idle" ? (
          <div className="mt-4 space-y-2.5">
            <Progress
              value={phase === "done" ? 100 : Math.max(8, (activeStepIndex / CHECK_STEPS.length) * 100)}
              aria-label="Прогресс проверки аналитика"
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
              <p className="text-sm font-medium">Аналитик ещё не запускался</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Проверка сверит текст с сущностями и их связями: факты, имена, статусы и
                требования — для рукописи или документации.
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

            {/* Фильтр по типу находки */}
            <div
              className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5"
              role="group"
              aria-label="Фильтр по типу находок"
            >
              {TYPE_FILTERS.map((filter) => (
                <SelectableChip
                  key={filter.id}
                  label={filter.label}
                  selected={typeFilter === filter.id}
                  onClick={() => setTypeFilter(filter.id)}
                  count={typeCounts[filter.id]}
                />
              ))}
            </div>

            {/* Список находок */}
            {visibleFindings.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Находок этого типа нет — попробуйте другой фильтр.
              </p>
            ) : (
              <ul className="space-y-2.5" aria-label="Находки проверки аналитика">
                {visibleFindings.map((finding) => (
                  <AnalystFindingRow
                    key={finding.id}
                    finding={finding}
                    status={statuses[finding.id] ?? "new"}
                    expanded={expandedId === finding.id}
                    onToggleQuote={() =>
                      setExpandedId((prev) => (prev === finding.id ? null : finding.id))
                    }
                    onSetStatus={(status) => setStatuses((prev) => ({ ...prev, [finding.id]: status }))}
                  />
                ))}
              </ul>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Проверка запускается вручную и ничего не переписывает: правки вносите вы, затем
              отмечайте находку исправленной.
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
        tone === "destructive" && "border-destructive/40",
        tone === "amber" && "border-amber-500/40",
        tone === "muted" && "border-border bg-muted/40",
      )}
    >
      <p className="text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p
        className={cn(
          "mt-1.5 text-[11px] font-medium text-muted-foreground",
          tone === "destructive" && "text-destructive",
          tone === "amber" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {label}
      </p>
    </div>
  );
}

function AnalystFindingRow({
  finding,
  status,
  expanded,
  onToggleQuote,
  onSetStatus,
}: {
  finding: AnalystFinding;
  status: AnalystStatus;
  expanded: boolean;
  onToggleQuote: () => void;
  onSetStatus: (status: AnalystStatus) => void;
}) {
  const typeMeta = ANALYST_TYPE_META[finding.type];
  const severityMeta = ANALYST_SEVERITY_META[finding.severity];
  const isNarrative = finding.domain === "narrative";

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
        <p className="min-w-0 flex-1 text-sm leading-snug">{finding.message}</p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          {finding.source}
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
          <p
            className={cn(
              "border-l-2 border-primary/50 pl-3 text-[13px] leading-relaxed text-foreground/85",
              isNarrative ? "font-serif italic" : "italic",
            )}
          >
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
