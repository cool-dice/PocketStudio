import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PAYOUT_METHODS, type PayoutMethod } from "./data";

/** One payout destination card. */
function PayoutCard({ method }: { method: PayoutMethod }) {
  const Icon = method.icon;

  return (
    <article className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 font-medium leading-snug">
          <span className="truncate">{method.name}</span>
          {method.isDefault ? (
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                "border-primary/30 bg-primary/10 text-primary",
              )}
            >
              По умолчанию
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Куда приходят выплаты со всех площадок
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Изменить способ выплаты: ${method.name}`}
      >
        Изменить
      </Button>
    </article>
  );
}

/** Payout destinations + the payout schedule note. */
export function PayoutsSection() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {PAYOUT_METHODS.map((method) => (
          <PayoutCard key={method.id} method={method} />
        ))}
      </div>
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        Выплата раз в месяц · порог 5 000 ₽ · следующая 1 ноября
      </p>
    </div>
  );
}
