import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Tier {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  current?: boolean;
  popular?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Бесплатно",
    price: "0 ₽",
    period: "навсегда",
    features: [
      "1 проект в студии",
      "Базовая генерация текста",
      "Водяной знак на экспортах",
    ],
    cta: "Текущий план",
    current: true,
  },
  {
    id: "pro",
    name: "Про",
    price: "590 ₽",
    period: "/мес",
    features: [
      "Без водяного знака",
      "Приоритет в очереди генерации",
      "5 проектов в студии",
    ],
    cta: "Оформить",
    popular: true,
  },
  {
    id: "studio",
    name: "Студия",
    price: "1 490 ₽",
    period: "/мес",
    features: [
      "Всё из тарифа «Про»",
      "Командный доступ",
      "Приоритетный рендер видео",
      "Свой домен для страницы",
    ],
    cta: "Оформить",
  },
];

/** Access plans for selling the studio itself. */
export function PricingTiers() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {TIERS.map((tier) => (
        <article
          key={tier.id}
          aria-current={tier.current ? "true" : undefined}
          className={cn(
            "relative flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-colors",
            tier.popular
              ? "border-primary shadow-md"
              : "hover:border-primary/40",
          )}
        >
          {tier.popular ? (
            <Badge className="absolute -top-2.5 left-4">Популярный выбор</Badge>
          ) : null}

          <h3 className="text-sm font-medium text-muted-foreground">
            {tier.name}
          </h3>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-1">
            <span className="text-2xl font-semibold tracking-tight">
              {tier.price}
            </span>
            <span className="text-sm text-muted-foreground">{tier.period}</span>
          </p>

          <ul className="mt-4 flex flex-1 flex-col gap-2.5 text-sm">
            {tier.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="leading-snug">{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            className="mt-5 w-full"
            variant={tier.current ? "outline" : "default"}
            disabled={tier.current}
            aria-label={
              tier.current
                ? `Тариф «${tier.name}» — ваш текущий план`
                : `Оформить тариф «${tier.name}»`
            }
          >
            {tier.current ? "Текущий план" : tier.cta}
          </Button>
        </article>
      ))}
    </div>
  );
}
