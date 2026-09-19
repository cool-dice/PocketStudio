"use client";

/**
 * Admin audit trail — own loading/error/empty/403, never paints a failed
 * fetch as «журнал пуст», never renders raw meta / API keys.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, ScrollText, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import {
  AUDIT_EMPTY,
  AUDIT_EMPTY_HINT,
  AUDIT_FORBIDDEN,
  AUDIT_FORBIDDEN_HINT,
  AUDIT_HINT,
  AUDIT_LIMIT_DEFAULT,
  AUDIT_LOAD_ERROR,
  AUDIT_LOAD_ERROR_HINT,
  AUDIT_LOAD_MORE,
  AUDIT_RETRY,
  AUDIT_TITLE,
  auditListView,
  auditLoadErrorFromHttp,
} from "@/lib/audit-copy";
import { relativeTime } from "@/lib/format";
import type { AuditLogEntry } from "@/lib/types";

export function AdminAuditPanel({ refreshNonce = 0 }: { refreshNonce?: number }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadPage = useCallback(async (offset: number, append: boolean) => {
    const page = await api.adminAudit(AUDIT_LIMIT_DEFAULT, offset);
    setEntries((prev) => (append ? [...prev, ...page.entries] : page.entries));
    setHasMore(page.hasMore);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadPage(0, false)
      .catch((err) => {
        if (cancelled) return;
        setEntries([]);
        setHasMore(false);
        if (err instanceof ApiError) {
          setLoadError(auditLoadErrorFromHttp(err.status, err.message));
          return;
        }
        setLoadError(AUDIT_LOAD_ERROR);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadPage, refreshNonce]);

  const retry = () => {
    setLoading(true);
    void loadPage(0, false)
      .catch((err) => {
        setEntries([]);
        if (err instanceof ApiError) {
          setLoadError(auditLoadErrorFromHttp(err.status, err.message));
          return;
        }
        setLoadError(AUDIT_LOAD_ERROR);
      })
      .finally(() => setLoading(false));
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    void loadPage(entries.length, true)
      .catch((err) => {
        toast.error(
          err instanceof ApiError
            ? auditLoadErrorFromHttp(err.status, err.message)
            : AUDIT_LOAD_ERROR,
        );
      })
      .finally(() => setLoadingMore(false));
  };

  const view = auditListView(loading, loadError, entries.length);

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-6">
      <h2 className="text-sm font-semibold">{AUDIT_TITLE}</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">{AUDIT_HINT}</p>
      {view === "loading" ? (
        <div className="mt-3 space-y-2" role="status" aria-label="Загрузка журнала">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-xl" />
          ))}
        </div>
      ) : view === "forbidden" ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">{AUDIT_FORBIDDEN}</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {AUDIT_FORBIDDEN_HINT}
          </p>
        </div>
      ) : view === "error" ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-sm font-medium">{loadError ?? AUDIT_LOAD_ERROR}</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {AUDIT_LOAD_ERROR_HINT}
          </p>
          <Button variant="outline" size="sm" className="mt-1 rounded-xl" onClick={retry}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {AUDIT_RETRY}
          </Button>
        </div>
      ) : view === "empty" ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted">
            <ScrollText className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">{AUDIT_EMPTY}</p>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {AUDIT_EMPTY_HINT}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-center gap-2 border-b py-2.5 text-sm last:border-b-0"
              >
                <Badge
                  variant={e.action.startsWith("admin.") ? "default" : "secondary"}
                  className="shrink-0 rounded-full px-1.5 font-mono text-[10px]"
                >
                  {e.action}
                </Badge>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {e.user ? `${e.user.name} · ${e.user.email}` : "система"}
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/80">
                  {relativeTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={loadingMore}
                onClick={loadMore}
              >
                {loadingMore ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {AUDIT_LOAD_MORE}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
