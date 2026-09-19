"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { adminPaymentsHint, offerPaidLabel } from "@/lib/payout-copy";

export function AdminOffersPanel() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.listAdminOffers>>>(
    [],
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await api.listAdminOffers();
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
          err instanceof ApiError ? err.message : "Не удалось загрузить офферы";
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

  async function markPaid(id: string) {
    setBusyId(id);
    try {
      await api.markOfferPaid(id);
      toast.success("Оффер отмечен оплаченным (симуляция), выплата в кабинете автора");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось отметить оплату",
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
        aria-label="Загрузка оплат"
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
                    : "Не удалось загрузить офферы";
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
      <p className="text-xs text-muted-foreground">{adminPaymentsHint()}</p>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Офферов пока нет — пользователь создаёт их во вкладке «Доход».
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm"
            >
              <Banknote className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium">{row.title}</span>
              <span className="text-xs text-muted-foreground">
                {(row.priceCents / 100).toFixed(0)} {row.currency} · {row.userName} ·{" "}
                {row.workspaceName}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-[11px]">
                {row.status}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {row.paymentMode === "live" ? "live" : "симуляция"}
              </span>
              {row.status !== "paid" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  disabled={busyId === row.id}
                  onClick={() => void markPaid(row.id)}
                >
                  {busyId === row.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Отметить оплачено
                </Button>
              ) : (
                <span className="ml-auto text-xs text-emerald-700 dark:text-emerald-400">
                  {offerPaidLabel(row.paymentMode)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
