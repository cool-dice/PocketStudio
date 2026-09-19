"use client";

import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppUi } from "@/lib/store";

/**
 * Loading / error / empty for the global «choose a workspace» chip bars.
 * A failed fetch must not look like «воркспейсов пока нет».
 */
export function WorkspacePickerStatus({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  const setMainArea = useAppUi((s) => s.setMainArea);

  if (loading) {
    return (
      <div className="mt-3 flex flex-wrap gap-1.5" aria-busy="true" aria-label="Загрузка воркспейсов">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-36 rounded-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed p-4"
      >
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          Не удалось загрузить воркспейсы
        </p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Повторить
        </Button>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed p-4">
        <p className="text-sm text-muted-foreground">
          Пока нет ни одного воркспейса — сначала создайте его.
        </p>
        <Button size="sm" onClick={() => setMainArea("workspaces")}>
          К воркспейсам
        </Button>
      </div>
    );
  }

  return <div className="mt-3 flex flex-wrap gap-1.5">{children}</div>;
}
