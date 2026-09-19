"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { adminPayoutHint, payoutStatusLabel } from "@/lib/payout-copy";

type AdminPayout = Awaited<ReturnType<typeof api.listAdminPayouts>>[number];

export function AdminPayoutsPanel() {
  const [rows, setRows] = useState<AdminPayout[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await api.listAdminPayouts();
    setRows(next);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load()
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError ? err.message : "Не удалось загрузить выплаты";
        setLoadError(message);
        toast.error(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function mark(id: string, status: "paid" | "failed") {
    setBusyId(id);
    try {
      await api.patchPayout(id, status);
      toast.success(
        status === "paid"
          ? "Выплата отмечена выплаченной (статус, не перевод)"
          : "Выплата отмечена как сбой (перевод не выполнялся)",
      );
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось изменить статус выплаты",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div
        className="h-40 animate-pulse rounded-2xl border bg-muted/40"
        role="status"
        aria-label="Загрузка выплат"
      />
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => {
            setLoading(true);
            void load()
              .catch((err) => {
                const message =
                  err instanceof ApiError
                    ? err.message
                    : "Не удалось загрузить выплаты";
                setLoadError(message);
              })
              .finally(() => setLoading(false));
          }}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Выплаты</h3>
        <p className="mt-1 text-xs text-muted-foreground">{adminPayoutHint()}</p>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Выплат пока нет — они появляются после отметки оффера оплаченным.
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm"
            >
              <Wallet className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium tabular-nums">
                {(row.amountCents / 100).toFixed(0)} {row.currency}
              </span>
              <span className="text-xs text-muted-foreground">
                {row.userName} · {row.userEmail}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-[11px]">
                {payoutStatusLabel(row.status)}
              </span>
              {row.status === "pending" ? (
                <span className="ml-auto flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.id}
                    onClick={() => void mark(row.id, "paid")}
                  >
                    {busyId === row.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    Отметить выплаченным
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === row.id}
                    onClick={() => void mark(row.id, "failed")}
                  >
                    <Ban className="size-3.5" aria-hidden="true" />
                    Сбой
                  </Button>
                </span>
              ) : (
                <span className="ml-auto text-xs text-muted-foreground">
                  {row.note ?? "Статус в студии, не перевод"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
