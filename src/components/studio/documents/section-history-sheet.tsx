"use client";

/**
 * Панель истории версий главы (PS-6): снапшоты, которые студия делает
 * перед каждой перезаписью текста (сессии правок дедуплицируются).
 * «Восстановить» возвращает текст версии в редактор — текущий текст
 * при этом тоже сохраняется в историю (source: restore), откат обратим.
 */

import { History, Loader2, RotateCcw, ScrollText } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { DocumentSectionDto, SectionRevisionDto } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { agoFromISO, formatNumber } from "./types";

const SOURCE_META: Record<SectionRevisionDto["source"], { label: string; className: string }> = {
  manual: {
    label: "правка",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  ai: {
    label: "ИИ",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  restore: {
    label: "откат",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
};

function timeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SectionHistorySheet({
  section,
  open,
  onOpenChange,
  onRestored,
}: {
  section: DocumentSectionDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Обновлённая секция после восстановления — прокинуть в редактор. */
  onRestored: (section: DocumentSectionDto) => void;
}) {
  const [revisions, setRevisions] = useState<SectionRevisionDto[] | null>(null);
  const [error, setError] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const sectionId = section?.id ?? null;

  useEffect(() => {
    if (!open || !sectionId) return;
    let cancelled = false;
    setRevisions(null);
    setError(false);
    api
      .listSectionRevisions(sectionId)
      .then((list) => {
        if (!cancelled) setRevisions(list);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sectionId]);

  const handleRetry = useCallback(() => {
    if (!sectionId) return;
    setError(false);
    setRevisions(null);
    api
      .listSectionRevisions(sectionId)
      .then(setRevisions)
      .catch(() => setError(true));
  }, [sectionId]);

  const handleRestore = useCallback(
    async (revision: SectionRevisionDto) => {
      if (!sectionId || restoringId) return;
      setRestoringId(revision.id);
      try {
        const restored = await api.restoreSectionRevision(sectionId, revision.id);
        onRestored(restored);
        // Обновляем список: сверху появился снапшот «откат».
        const list = await api.listSectionRevisions(sectionId);
        setRevisions(list);
      } catch {
        setError(true);
      } finally {
        setRestoringId(null);
      }
    },
    [sectionId, restoringId, onRestored],
  );

  return (
    <Sheet open={open && Boolean(section)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="shrink-0 space-y-1.5 border-b px-5 pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg border bg-primary/10 text-primary">
              <History className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                История версий
              </p>
              <p className="truncate text-xs text-muted-foreground">{section?.title}</p>
            </div>
          </div>
          <SheetTitle className="text-left text-base">Версии главы</SheetTitle>
          <SheetDescription>
            Студия сохраняет снимок перед каждой перезаписью — восстановление
            обратимо, текущий текст тоже попадёт в историю.
          </SheetDescription>
        </SheetHeader>

        <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {revisions === null && !error ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="text-sm font-medium">История не загрузилась</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRetry}
              >
                Попробовать снова
              </Button>
            </div>
          ) : revisions && revisions.length > 0 ? (
            <ol className="space-y-2.5">
              {revisions.map((revision) => {
                const meta = SOURCE_META[revision.source];
                return (
                  <li
                    key={revision.id}
                    className="rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          meta.className,
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs font-medium">{timeLabel(revision.createdAt)}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {agoFromISO(revision.createdAt)}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {formatNumber(revision.size)} симв.
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {revision.preview}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2.5 h-7 gap-1.5 text-[11px]"
                      disabled={restoringId !== null}
                      onClick={() => handleRestore(revision)}
                    >
                      {restoringId === revision.id ? (
                        <>
                          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                          Восстанавливаем…
                        </>
                      ) : (
                        <>
                          <RotateCcw className="size-3" aria-hidden="true" />
                          Восстановить этот текст
                        </>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span
                className="flex size-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground"
                aria-hidden="true"
              >
                <ScrollText className="size-6" />
              </span>
              <p className="text-sm font-medium">Версий пока нет</p>
              <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
                Правьте главу — перед следующей перезаписью студия сохранит
                снимок, и его можно будет вернуть.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
