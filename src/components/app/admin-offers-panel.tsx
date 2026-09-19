"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";

export function AdminOffersPanel() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.listAdminOffers>>>(
    [],
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.listAdminOffers());
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось загрузить офферы",
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markPaid(id: string) {
    setBusyId(id);
    try {
      await api.markOfferPaid(id);
      toast.success("Оффер отмечен оплаченным, выплата в кабинете автора");
      await load();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось отметить оплату",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Платежи в режиме simulated. «Отметить оплачено» создаёт выплату автору оффера.
      </p>
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
                  оплачено
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
