"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";
import {
  offerCheckoutSuccessCopy,
  offerPaidLabel,
  payoutStatusLabel,
} from "@/lib/payout-copy";

export function OfferCabinet({ workspaceId }: { workspaceId: string }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("100");
  const [mode, setMode] = useState<"simulated" | "live">("simulated");
  const [adapter, setAdapter] = useState<{
    liveKeyConfigured: boolean;
    modes: { id: string; label: string; hint: string }[];
  } | null>(null);
  const [offers, setOffers] = useState<
    Awaited<ReturnType<typeof api.listOffers>>
  >([]);
  const [payouts, setPayouts] = useState<Awaited<ReturnType<typeof api.listPayouts>> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [o, p, pay] = await Promise.all([
      api.listOffers(workspaceId),
      api.listPayouts(),
      api.paymentsStatus().catch(() => null),
    ]);
    setOffers(o);
    setPayouts(p);
    if (pay) setAdapter(pay);
    setLoadError(null);
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    void load().catch((err) => {
      if (cancelled) return;
      const message =
        err instanceof ApiError ? err.message : "Не удалось загрузить кабинет";
      setLoadError(message);
      toast.error(message);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function create() {
    const cents = Math.round(Number(price.replace(",", ".")) * 100);
    if (!title.trim() || Number.isNaN(cents) || cents < 0) {
      toast.error("Укажите название и цену");
      return;
    }
    setBusy(true);
    try {
      await api.createOffer({
        projectId: workspaceId,
        title: title.trim(),
        priceCents: cents,
        paymentMode: mode,
      });
      setTitle("");
      toast.success("Оффер создан");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось создать оффер");
    } finally {
      setBusy(false);
    }
  }

  async function checkout(id: string, paymentMode: string) {
    try {
      await api.checkoutOffer(id);
      toast.success(offerCheckoutSuccessCopy(paymentMode));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Оплата не прошла");
    }
  }

  if (loadError) {
    return (
      <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Banknote className="size-4 text-primary" />
          Кабинет: офферы и выплаты
        </h2>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            void load().catch((err) => {
              setLoadError(
                err instanceof ApiError ? err.message : "Не удалось загрузить кабинет",
              );
            })
          }
        >
          <RefreshCw className="size-4" /> Повторить
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Banknote className="size-4 text-primary" />
        Кабинет: офферы и выплаты
      </h2>
      <p className="text-xs text-muted-foreground">
        Адаптер: {mode === "simulated" ? "симуляция" : "live"}.
        {adapter?.liveKeyConfigured
          ? " PAYMENTS_API_KEY задан, но карта всё равно не списывается."
          : " Живой ключ не задан — live откажет честно."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название оффера"
          className="min-w-40 flex-1"
          aria-label="Название оффера"
        />
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Цена, ₽"
          className="w-28"
          aria-label="Цена в рублях"
        />
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={mode}
          onChange={(e) => setMode(e.target.value === "live" ? "live" : "simulated")}
          aria-label="Режим оплаты"
        >
          <option value="simulated">Симуляция</option>
          <option value="live">Live</option>
        </select>
        <Button size="sm" onClick={() => void create()} disabled={busy}>
          <Plus className="size-3.5" /> Создать
        </Button>
      </div>
      <ul className="space-y-2">
        {offers.length === 0 ? (
          <li className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            Офферов пока нет — создайте черновик. «Оплачено» появляется только после
            симуляции или пометки админа. Клиент не может сам отметить live-оплату.
          </li>
        ) : (
          offers.map((o) => (
            <li
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                {o.title} · {(o.priceCents / 100).toFixed(0)} {o.currency} ·{" "}
                <span className="text-muted-foreground">{o.status}</span>
              </span>
              {o.status !== "paid" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void checkout(o.id, o.paymentMode)}
                >
                  {o.paymentMode === "live" ? "Оплатить (live)" : "Симулировать оплату"}
                </Button>
              ) : (
                <span className="text-xs text-emerald-600">
                  {offerPaidLabel(o.paymentMode)}
                </span>
              )}
            </li>
          ))
        )}
      </ul>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          {payouts
            ? `К выплате: ${(payouts.totalPendingCents / 100).toFixed(0)} ₽ · выплачено (симуляция): ${(payouts.totalPaidCents / 100).toFixed(0)} ₽`
            : "Загружаем выплаты…"}
        </p>
        <ul className="space-y-1">
          {!payouts || payouts.payouts.length === 0 ? (
            <li className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              Выплат пока нет. Они появляются после симуляции или пометки админа —
              не после живой карты.
            </li>
          ) : (
            payouts.payouts.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <span>
                  {(p.amountCents / 100).toFixed(0)} {p.currency}
                  {p.note ? ` · ${p.note}` : ""}
                </span>
                <span className="text-muted-foreground">{payoutStatusLabel(p.status)}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
