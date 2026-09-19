"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api";

export function OfferCabinet({ workspaceId }: { workspaceId: string }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("100");
  const [offers, setOffers] = useState<
    Awaited<ReturnType<typeof api.listOffers>>
  >([]);
  const [payouts, setPayouts] = useState<Awaited<ReturnType<typeof api.listPayouts>> | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([
        api.listOffers(workspaceId),
        api.listPayouts(),
      ]);
      setOffers(o);
      setPayouts(p);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось загрузить кабинет");
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
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
        paymentMode: "simulated",
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

  async function checkout(id: string) {
    try {
      await api.checkoutOffer(id);
      toast.success("Симулированная оплата прошла, выплата в кабинете");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Оплата не прошла");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Banknote className="size-4 text-primary" />
        Кабинет: офферы и выплаты
      </h2>
      <p className="text-xs text-muted-foreground">
        Платёжный адаптер по умолчанию — simulated. Живой ключ задаётся через
        PAYMENTS_API_KEY; админ может отметить оплату вручную.
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
        <Button size="sm" onClick={() => void create()} disabled={busy}>
          <Plus className="size-3.5" /> Создать
        </Button>
      </div>
      <ul className="space-y-2">
        {offers.map((o) => (
          <li
            key={o.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <span>
              {o.title} · {(o.priceCents / 100).toFixed(0)} {o.currency} ·{" "}
              <span className="text-muted-foreground">{o.status}</span>
            </span>
            {o.status !== "paid" ? (
              <Button size="sm" variant="outline" onClick={() => void checkout(o.id)}>
                Симулировать оплату
              </Button>
            ) : (
              <span className="text-xs text-emerald-600">оплачено</span>
            )}
          </li>
        ))}
      </ul>
      {payouts ? (
        <p className="text-xs text-muted-foreground">
          К выплате: {(payouts.totalPendingCents / 100).toFixed(0)} ₽ · выплачено:{" "}
          {(payouts.totalPaidCents / 100).toFixed(0)} ₽
        </p>
      ) : null}
    </section>
  );
}
