"use client";

/**
 * Вкладка «Аналитик» (Фаза A, живой LLM): находки из REST API
 * (listFindings), область — документ воркспейса (переключатель из
 * listDocuments). «Проверить документ» → aiAnalyze (~30–60 секунд,
 * состояние загрузки с таймером и живым счётчиком секунд). Фильтры по
 * статусу и типу со счётчиками; «Исправлено»/«Отклонить» →
 * updateFinding — карточка уходит из открытых, счётчики живые.
 */

import { Check, ChevronDown, Loader2, ScanSearch, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { DocumentDto, FindingDto, FindingStatus, FindingType } from "@/lib/workspace-types";
import { SelectableChip } from "./narrative-chip";
import {
  FINDING_SEVERITY_META,
  FINDING_STATUS_META,
  FINDING_TYPE_FILTERS,
  FINDING_TYPE_META,
} from "./analyst-data";
import { pluralRu } from "./types";

type StatusFilter = FindingStatus | "all";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Открытые" },
  { id: "fixed", label: "Исправленные" },
  { id: "dismissed", label: "Отклонённые" },
  { id: "all", label: "Все" },
];

export function AnalystTab({
  workspaceId,
  documents,
  onCountChange,
}: {
  workspaceId: string | null;
  documents: DocumentDto[];
  onCountChange?: (count: number) => void;
}) {
  const [findings, setFindings] = useState<FindingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [docId, setDocId] = useState<string | null>(documents[0]?.id ?? null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [typeFilter, setTypeFilter] = useState<FindingType | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  /* ── Загрузка ── */
  useEffect(() => {
    if (!workspaceId) {
      setFindings([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api
      .listFindings(workspaceId)
      .then((list) => {
        if (cancelled) return;
        setFindings(list);
        setLoadError(false);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  // Документ по умолчанию — первый в списке (или не меняем выбор).
  useEffect(() => {
    if (documents.length > 0 && !documents.some((doc) => doc.id === docId)) {
      setDocId(documents[0].id);
    }
  }, [documents, docId]);

  const activeDoc = documents.find((doc) => doc.id === docId) ?? null;
  const docFindings = useMemo(
    () => findings.filter((finding) => finding.documentId === docId),
    [findings, docId],
  );

  const openCount = docFindings.filter((finding) => finding.status === "open").length;
  useEffect(() => {
    onCountChange?.(openCount);
  }, [openCount, onCountChange]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      open: 0,
      fixed: 0,
      dismissed: 0,
      all: docFindings.length,
    };
    docFindings.forEach((finding) => {
      counts[finding.status] += 1;
    });
    return counts;
  }, [docFindings]);

  const inStatus = useMemo(
    () =>
      statusFilter === "all"
        ? docFindings
        : docFindings.filter((finding) => finding.status === statusFilter),
    [docFindings, statusFilter],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<FindingType | "all", number> = {
      all: inStatus.length,
      contradiction: 0,
      omission: 0,
      inconsistency: 0,
    };
    inStatus.forEach((finding) => {
      counts[finding.type] += 1;
    });
    return counts;
  }, [inStatus]);

  const visibleFindings = useMemo(
    () =>
      typeFilter === "all"
        ? inStatus
        : inStatus.filter((finding) => finding.type === typeFilter),
    [inStatus, typeFilter],
  );

  /* ── Действия ── */

  /** Живая проверка: LLM читает рукопись (~30–60 c) → новые находки. */
  async function runCheck() {
    if (analyzing || !activeDoc) return;
    setAnalyzing(true);
    setElapsed(0);
    setExpandedId(null);
    timerRef.current = window.setInterval(() => setElapsed((prev) => prev + 1), 1000);
    try {
      const created = await api.aiAnalyze({
        documentId: activeDoc.id,
        scope: activeDoc.kind === "spec" ? "spec" : "manuscript",
      });
      // Бэкенд заменил открытые находки документа — отражаем локально.
      setFindings((prev) => [
        ...prev.filter(
          (finding) =>
            finding.documentId !== activeDoc.id || finding.status !== "open",
        ),
        ...created,
      ]);
      toast.success("Аналитик закончил", {
        description: `${created.length} ${pluralRu(created.length, "новая находка", "новые находки", "новых находок")} — смотрите отчёт ниже.`,
      });
    } catch {
      toast.error("Аналитик не справился", {
        description: "Попробуйте ещё раз через минуту.",
      });
    } finally {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      setAnalyzing(false);
    }
  }

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    },
    [],
  );

  async function setFindingStatus(id: string, status: FindingStatus) {
    try {
      const updated = await api.updateFinding(id, status);
      setFindings((prev) =>
        prev.map((finding) => (finding.id === id ? updated : finding)),
      );
    } catch {
      toast.error("Не удалось обновить находку");
    }
  }

  function switchDocument(nextId: string) {
    if (nextId === docId) return;
    setDocId(nextId);
    setStatusFilter("open");
    setTypeFilter("all");
    setExpandedId(null);
  }

  const counts = {
    total: docFindings.length,
    critical: docFindings.filter((finding) => finding.severity === "critical").length,
    warning: docFindings.filter((finding) => finding.severity === "warning").length,
    info: docFindings.filter((finding) => finding.severity === "info").length,
  };

  /* ── Рендер ── */

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
            {analyzing ? (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
                Аналитик читает рукопись… {elapsed} с
              </span>
            ) : null}
            <Button
              type="button"
              onClick={runCheck}
              disabled={analyzing || !activeDoc}
            >
              {analyzing ? (
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
          </div>
        </div>

        {/* Область проверки — документы воркспейса */}
        <div
          className="vf-scroll-x mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5"
          role="group"
          aria-label="Область проверки"
        >
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              В воркспейсе пока нет документов для проверки.
            </p>
          ) : (
            documents.map((doc) => (
              <SelectableChip
                key={doc.id}
                label={doc.title}
                selected={docId === doc.id}
                onClick={() => switchDocument(doc.id)}
              />
            ))
          )}
        </div>

        {/* Состояние живой проверки */}
        {analyzing ? (
          <div className="mt-4 space-y-2.5">
            <Progress
              value={Math.min(95, (elapsed / 45) * 100)}
              aria-label="Прогресс проверки аналитика"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              LLM читает разделы документа и сверяет их между собой — обычно 30–60 секунд.
              Вкладку можно не покидать: находки появятся сами.
            </p>
          </div>
        ) : null}
      </div>

      {/* Тело: загрузка / пустые состояния / отчёт */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">Находки не загрузились</p>
            <p className="text-xs text-muted-foreground">Проверьте соединение и обновите вкладку.</p>
          </div>
        ) : !activeDoc ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">Проверять пока нечего</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              Создайте документ во вкладке «Рукопись» — затем возвращайтесь к Аналитику.
            </p>
          </div>
        ) : docFindings.length === 0 ? (
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
                «{activeDoc.title}»: проверка найдёт противоречия, недосказанности и расхождения
                в тексте.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Сводка */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Сводка находок">
              <SummaryTile label="Всего" value={counts.total} tone="neutral" />
              <SummaryTile label="Критичные" value={counts.critical} tone="rose" />
              <SummaryTile label="Внимание" value={counts.warning} tone="amber" />
              <SummaryTile label="Заметки" value={counts.info} tone="sky" />
            </div>

            {/* Фильтр по статусу */}
            <div
              className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5"
              role="group"
              aria-label="Фильтр по статусу находок"
            >
              {STATUS_FILTERS.map((filter) => (
                <SelectableChip
                  key={filter.id}
                  label={filter.label}
                  selected={statusFilter === filter.id}
                  onClick={() => setStatusFilter(filter.id)}
                  count={statusCounts[filter.id]}
                />
              ))}
            </div>

            {/* Фильтр по типу */}
            <div
              className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5"
              role="group"
              aria-label="Фильтр по типу находок"
            >
              <SelectableChip
                label="Все"
                selected={typeFilter === "all"}
                onClick={() => setTypeFilter("all")}
                count={typeCounts.all}
              />
              {FINDING_TYPE_FILTERS.map((type) => (
                <SelectableChip
                  key={type}
                  label={FINDING_TYPE_META[type].plural}
                  selected={typeFilter === type}
                  onClick={() => setTypeFilter(type)}
                  count={typeCounts[type]}
                />
              ))}
            </div>

            {/* Список находок */}
            {visibleFindings.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Находок с такими фильтрами нет — попробуйте другой тип или статус.
              </p>
            ) : (
              <ul className="space-y-2.5" aria-label="Находки проверки аналитика">
                {visibleFindings.map((finding) => (
                  <FindingRow
                    key={finding.id}
                    finding={finding}
                    expanded={expandedId === finding.id}
                    onToggleQuote={() =>
                      setExpandedId((prev) => (prev === finding.id ? null : finding.id))
                    }
                    onSetStatus={(status) => setFindingStatus(finding.id, status)}
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

function FindingRow({
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
