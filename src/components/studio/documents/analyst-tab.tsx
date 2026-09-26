"use client";

/**
 * Вкладка «Аналитик»: находки из REST (listFindings).
 * «Проверить документ» → POST /api/ai/analyze (инструмент document_check).
 * Ненастроенная модель → русская ошибка, без фейковых находок.
 * «Исправлено»/«Отклонить» → PATCH /api/findings/[id].
 */

import { Loader2, ScanSearch } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import {
  ANALYST_CHECK_FAILED,
  ANALYST_CHECK_FAILED_HINT,
  ANALYST_CHECK_UNCONFIGURED_HINT,
  ANALYST_EMPTY_OK,
  ANALYST_EMPTY_OK_HINT,
  ANALYST_LOAD_ERROR,
  ANALYST_LOAD_ERROR_HINT,
  ANALYST_NEVER_RAN,
  ANALYST_NEVER_RAN_HINT,
  ANALYST_NO_DOCUMENTS,
  ANALYST_NOTHING_TO_CHECK,
  ANALYST_NOTHING_TO_CHECK_HINT,
  ANALYST_STATUS_FAILED,
} from "@/lib/analyst-copy";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import type { DocumentDto, FindingDto, FindingStatus, FindingType } from "@/lib/workspace-types";
import { SelectableChip } from "./narrative-chip";
import { FINDING_TYPE_FILTERS, FINDING_TYPE_META } from "./analyst-data";
import { FindingCard, SummaryTile } from "./finding-card";
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
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checkedEmptyDocId, setCheckedEmptyDocId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

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
        if (!cancelled) {
          setLoadError(true);
          setFindings([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

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

  async function runCheck() {
    if (analyzing || !activeDoc) return;
    setAnalyzing(true);
    setElapsed(0);
    setExpandedId(null);
    setCheckError(null);
    timerRef.current = window.setInterval(() => setElapsed((prev) => prev + 1), 1000);
    try {
      const created = await api.aiAnalyze({
        documentId: activeDoc.id,
        scope: activeDoc.kind === "spec" ? "spec" : "manuscript",
      });
      setFindings((prev) => [
        ...prev.filter(
          (finding) =>
            finding.documentId !== activeDoc.id || finding.status !== "open",
        ),
        ...created,
      ]);
      setCheckedEmptyDocId(created.length === 0 ? activeDoc.id : null);
      toast.success("Аналитик закончил", {
        description: `${created.length} ${pluralRu(created.length, "новая находка", "новые находки", "новых находок")} — смотрите отчёт ниже.`,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : ANALYST_CHECK_FAILED;
      setCheckError(message);
      setCheckedEmptyDocId(null);
      toast.error(message, {
        description:
          message === UNCONFIGURED_TOOL_MESSAGE
            ? ANALYST_CHECK_UNCONFIGURED_HINT
            : ANALYST_CHECK_FAILED_HINT,
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
      toast.error(ANALYST_STATUS_FAILED);
    }
  }

  function switchDocument(nextId: string) {
    if (nextId === docId) return;
    setDocId(nextId);
    setStatusFilter("open");
    setTypeFilter("all");
    setExpandedId(null);
    setCheckError(null);
  }

  const counts = {
    total: docFindings.length,
    critical: docFindings.filter((finding) => finding.severity === "critical").length,
    warning: docFindings.filter((finding) => finding.severity === "warning").length,
    info: docFindings.filter((finding) => finding.severity === "info").length,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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

        <div
          className="vf-scroll-x mt-3 flex items-center gap-1.5 overflow-x-auto pb-0.5"
          role="group"
          aria-label="Область проверки"
        >
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">{ANALYST_NO_DOCUMENTS}</p>
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

        {checkError ? (
          <div
            className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2"
            role="alert"
          >
            <p className="text-sm font-medium text-rose-700 dark:text-rose-300">{checkError}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {checkError === UNCONFIGURED_TOOL_MESSAGE
                ? ANALYST_CHECK_UNCONFIGURED_HINT
                : ANALYST_CHECK_FAILED_HINT}
            </p>
          </div>
        ) : null}
      </div>

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">{ANALYST_LOAD_ERROR}</p>
            <p className="text-xs text-muted-foreground">{ANALYST_LOAD_ERROR_HINT}</p>
          </div>
        ) : !activeDoc ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">{ANALYST_NOTHING_TO_CHECK}</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {ANALYST_NOTHING_TO_CHECK_HINT}
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
              <p className="text-sm font-medium">
                {checkedEmptyDocId === activeDoc.id ? ANALYST_EMPTY_OK : ANALYST_NEVER_RAN}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {checkedEmptyDocId === activeDoc.id
                  ? ANALYST_EMPTY_OK_HINT
                  : `«${activeDoc.title}»: ${ANALYST_NEVER_RAN_HINT}`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Сводка находок">
              <SummaryTile label="Всего" value={counts.total} tone="neutral" />
              <SummaryTile label="Критичные" value={counts.critical} tone="rose" />
              <SummaryTile label="Внимание" value={counts.warning} tone="amber" />
              <SummaryTile label="Заметки" value={counts.info} tone="sky" />
            </div>

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

            {visibleFindings.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Находок с такими фильтрами нет — попробуйте другой тип или статус.
              </p>
            ) : (
              <ul className="space-y-2.5" aria-label="Находки проверки аналитика">
                {visibleFindings.map((finding) => (
                  <FindingCard
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
