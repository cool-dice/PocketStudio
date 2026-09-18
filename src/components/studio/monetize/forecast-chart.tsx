"use client";

/**
 * Monetize (5-c) — «Прогноз»: CSS bar-chart из plan.forecast.monthly.
 * Три столбца с ростом, суммы в ₽ и честная подпись
 * «прогноз модели — не гарантия». Данные парсятся из секции «Прогноз»
 * план-документа (маркер ПРОГНОЗ_JSON первой строкой).
 */

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatRub, type PlanForecast } from "./plan-data";

export function ForecastChart({
  forecast,
  loading = false,
}: {
  forecast: PlanForecast | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-44 items-end justify-center gap-6 rounded-xl border bg-card p-4 sm:p-6">
        <Skeleton className="h-24 w-16 rounded-lg" />
        <Skeleton className="h-32 w-16 rounded-lg" />
        <Skeleton className="h-40 w-16 rounded-lg" />
      </div>
    );
  }

  if (!forecast || forecast.monthly.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-6 text-center">
        <TrendingUp
          className="mx-auto size-6 text-muted-foreground/50"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Прогноз появится вместе с планом монетизации
        </p>
      </div>
    );
  }

  const max = Math.max(...forecast.monthly.map((m) => m.amount), 1);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
      <div className="flex h-44 items-end justify-center gap-4 sm:gap-8">
        {forecast.monthly.map((m, i) => {
          const pct = Math.max(Math.round((m.amount / max) * 100), 4);
          return (
            <div
              key={`${m.label}-${i}`}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
            >
              <span className="text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatRub(m.amount)}
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.12, ease: "easeOut" }}
                className="w-full max-w-20 rounded-t-lg border border-emerald-500/40 bg-gradient-to-t from-emerald-600/50 to-emerald-500/25 transition-colors hover:from-emerald-600/60 hover:to-emerald-500/35"
                role="img"
                aria-label={`${m.label}: ${formatRub(m.amount)}`}
              />
              <span className="truncate text-xs text-muted-foreground">
                {m.label}
              </span>
            </div>
          );
        })}
      </div>
      {forecast.assumption ? (
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {forecast.assumption}
        </p>
      ) : null}
      <p className="mt-3 border-t pt-3 text-[11px] text-muted-foreground/70">
        Прогноз модели — не гарантия: суммы зависят от вашего запуска и каналов.
      </p>
    </div>
  );
}
