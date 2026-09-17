"use client";

/**
 * DiffDialog — checkpoint diff viewer (Stage 4): a large dialog with the
 * commit header (hash badge, message, author/date), a scrollable file tab
 * bar (added/modified/deleted color dots) and a Monaco side-by-side diff.
 * Inline toggle switches Monaco to the unified layout.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Columns2,
  FileDiff,
  GitCommitHorizontal,
  Loader2,
  Rows2,
} from "lucide-react";
import { toast } from "sonner";

import { MonacoDiff } from "@/components/app/monaco-diff";
import { languageFromPath } from "@/lib/project-style";
import { api, ApiError } from "@/lib/api";
import type { CommitDiff, CommitDiffFile, CommitInfo } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const STATUS_META: Record<
  CommitDiffFile["status"],
  { label: string; dot: string; badge: string }
> = {
  added: {
    label: "Новый",
    dot: "bg-emerald-500",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  modified: {
    label: "Изменён",
    dot: "bg-amber-500",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  deleted: {
    label: "Удалён",
    dot: "bg-rose-500",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

export function DiffDialog({
  open,
  onOpenChange,
  projectId,
  commit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  commit: CommitInfo | null;
}) {
  const [diff, setDiff] = useState<CommitDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [inline, setInline] = useState(false);
  const seqRef = useRef(0);

  const loadDiff = useCallback(async () => {
    if (!commit) return;
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    setDiff(null);
    setActivePath(null);
    try {
      const d = await api.getProjectDiff(projectId, commit.hash);
      if (seq !== seqRef.current) return;
      setDiff(d);
      setActivePath(d.files[0]?.path ?? null);
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(
        err instanceof ApiError ? err.message : "Не удалось загрузить diff",
      );
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [commit, projectId]);

  useEffect(() => {
    if (!open || !commit) return;
    void loadDiff();
    return () => {
      // Cancel in-flight responses when the dialog closes / commit changes.
      seqRef.current++;
    };
  }, [open, commit, loadDiff]);

  const activeFile = useMemo(
    () => diff?.files.find((f) => f.path === activePath) ?? null,
    [diff, activePath],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92dvh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 gap-1.5 border-b px-5 py-4">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <GitCommitHorizontal
              className="size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            {commit && (
              <Badge
                variant="outline"
                className="shrink-0 rounded-md border-emerald-500/30 bg-emerald-500/10 font-mono text-[11px] font-normal text-emerald-700 dark:text-emerald-300"
              >
                {commit.short}
              </Badge>
            )}
            <span className="min-w-0 basis-52 truncate">
              {commit?.message ?? "Diff коммита"}
            </span>
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            {commit && <span>{commit.author}</span>}
            {commit && <span aria-hidden="true">·</span>}
            {commit && <span>{new Date(commit.date).toLocaleString("ru-RU")}</span>}
            {diff && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {diff.files.length}{" "}
                  {diff.files.length === 1 ? "файл" : diff.files.length < 5 ? "файла" : "файлов"}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* File tabs */}
        {diff && diff.files.length > 0 && (
          <div
            className="vf-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-muted/40 px-3 py-2"
            role="tablist"
            aria-label="Изменённые файлы"
          >
            {diff.files.map((f) => {
              const meta = STATUS_META[f.status];
              const active = f.path === activePath;
              return (
                <button
                  key={f.path}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActivePath(f.path)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors duration-150",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", meta.dot)}
                    aria-hidden="true"
                  />
                  <span className="max-w-48 truncate">{f.path}</span>
                </button>
              );
            })}
            <div className="ml-auto shrink-0 pl-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setInline((v) => !v)}
                aria-pressed={inline}
                className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground"
                title={inline ? "Показать рядом" : "Показать в строку"}
              >
                {inline ? (
                  <Columns2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <Rows2 className="size-3.5" aria-hidden="true" />
                )}
                {inline ? "Рядом" : "Строкой"}
              </Button>
            </div>
          </div>
        )}

        {/* Per-file notices (skipped / truncated) — shrink-0 above the diff */}
        {activeFile?.skipped && !loading && (
          <p className="shrink-0 border-b border-dashed bg-muted/50 px-5 py-2 text-center text-xs text-muted-foreground">
            Файл бинарный или слишком большой — содержимое скрыто
          </p>
        )}
        {activeFile?.truncated && !loading && !activeFile.skipped && (
          <p className="shrink-0 border-b border-dashed bg-muted/50 px-5 py-2 text-center text-xs text-muted-foreground">
            Показаны первые 200 КБ файла
          </p>
        )}

        {/* Diff body — absolute inset-0 layer so Monaco always gets a
            definite size (percentage heights don't resolve inside dialogs
            whose flex height is content-driven with only max-h caps). */}
        <div className="relative min-h-[45dvh] flex-1 overflow-hidden">
          {loading ? (
            <div className="p-5" aria-label="Загрузка diff">
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  void toast.info("Закройте и откройте diff снова");
                }}
              >
                Понятно
              </Button>
            </div>
          ) : diff && diff.files.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
              <FileDiff className="size-8 text-muted-foreground/50" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                В этом коммите нет текстовых изменений
              </p>
            </div>
          ) : activeFile && !activeFile.skipped ? (
            <>
              <div className="absolute inset-0">
                <MonacoDiff
                  original={activeFile.original}
                  modified={activeFile.modified}
                  language={languageFromPath(activeFile.path)}
                  inline={inline}
                />
              </div>
              <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-normal backdrop-blur",
                    STATUS_META[activeFile.status].badge,
                  )}
                >
                  {STATUS_META[activeFile.status].label}: {activeFile.path}
                </Badge>
              </div>
            </>
          ) : null}
        </div>

        {diff && diff.skippedCount > 0 && (
          <p className="shrink-0 border-t bg-muted/40 px-5 py-2 text-center text-xs text-muted-foreground">
            Показаны первые 20 файлов · ещё {diff.skippedCount} не отображено
          </p>
        )}
        {loading && (
          <span
            className="absolute right-4 top-4 flex items-center gap-1.5 text-xs text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Загружаем diff…
          </span>
        )}
      </DialogContent>
    </Dialog>
  );
}
