import { ShoppingBag, TrendingUp, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface StatTile {
  id: string;
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
}

const TILES: StatTile[] = [
  {
    id: "revenue",
    label: "Доход за месяц",
    value: "128 400 ₽",
    trend: "+18%",
    icon: Wallet,
  },
  {
    id: "sales",
    label: "Продажи за месяц",
    value: "312",
    trend: "+7%",
    icon: ShoppingBag,
  },
  {
    id: "subscribers",
    label: "Подписчики",
    value: "1 284",
    trend: "+124 за неделю",
    icon: Users,
  },
];

/** Top row of key monetization numbers. */
export function StatTiles() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {TILES.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.id}
            className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{tile.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {tile.value}
              </p>
              <span
                className={cn(
                  "mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                  "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                )}
              >
                <TrendingUp className="size-3" aria-hidden="true" />
                {tile.trend}
              </span>
            </div>
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Icon className="size-5" />
            </span>
          </div>
        );
      })}
    </div>
  );
}
