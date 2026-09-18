import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { REVENUE_MONTHS } from "./data";

/**
 * CSS-only bar chart: 12 months of revenue. The current month is
 * highlighted, the rest are muted and react to hover; native title
 * attributes double as tooltips.
 */
export function RevenueChartCard() {
  const current = REVENUE_MONTHS.find((m) => m.isCurrent);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Оборот по месяцам, ₽</CardTitle>
          <CardDescription>
            Динамика продаж и подписок за последние 12 месяцев
          </CardDescription>
        </div>
        {current ? (
          <CardAction>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {current.tooltip} · {current.amountLabel}
            </span>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        <figure
          className="mt-1.5"
          aria-label="Столбчатая диаграмма оборота по месяцам за год"
          role="img"
        >
          <div className="flex h-40 items-end gap-1.5 sm:gap-2">
            {REVENUE_MONTHS.map((month) => (
              <div
                key={month.short}
                className="flex h-full flex-1 flex-col justify-end"
              >
                <div
                  className={cn(
                    "min-h-[4px] w-full cursor-help rounded-t transition-colors",
                    month.isCurrent
                      ? "bg-primary hover:bg-primary"
                      : "bg-primary/40 hover:bg-primary/80",
                  )}
                  style={{ height: `${month.value}%` }}
                  title={`${month.tooltip} · ${month.amountLabel}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5 sm:gap-2" aria-hidden="true">
            {REVENUE_MONTHS.map((month) => (
              <span
                key={month.short}
                className={cn(
                  "flex-1 text-center text-[10px] leading-none",
                  month.isCurrent
                    ? "font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                {month.short}
              </span>
            ))}
          </div>
          <figcaption className="mt-2 text-xs text-muted-foreground">
            Наведите на столбец, чтобы увидеть сумму месяца
          </figcaption>
          <span className="sr-only">
            {REVENUE_MONTHS.map(
              (m) => `${m.tooltip}: ${m.amountLabel}`,
            ).join(", ")}
          </span>
        </figure>
      </CardContent>
    </Card>
  );
}
