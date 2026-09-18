"use client";

import { Coins, Landmark } from "lucide-react";

import {
  ModuleHeader,
  WipBanner,
  type ModuleScreenProps,
} from "@/components/studio/shared/module-header";
import { Button } from "@/components/ui/button";

import { PayoutsSection } from "./payouts-section";
import { PricingTiers } from "./pricing-tiers";
import { PublicationsSection } from "./publications-section";
import { RevenueChartCard } from "./revenue-chart";
import { SectionHeading } from "./section-heading";
import { StatTiles } from "./stat-tiles";

/**
 * Monetization module — income stats, a CSS-only revenue chart, my
 * publications, studio access tiers and payout methods.
 * Pure visual mock: no fetch, local state only where needed.
 */
export function MonetizeScreen({ onOpenMobileNav }: ModuleScreenProps) {
  return (
    <section
      aria-label="Монетизация"
      className="flex h-full min-w-0 flex-1 flex-col bg-background"
    >
      <ModuleHeader
        icon={Coins}
        title="Монетизация"
        description="Публикации, тарифы и доход со ваших работ"
        stage="soon"
        onOpenMobileNav={onOpenMobileNav}
      >
        <Button variant="outline" size="sm">
          <Landmark className="size-4" aria-hidden="true" />
          Подключить выплаты
        </Button>
      </ModuleHeader>

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
          <StatTiles />

          <RevenueChartCard />

          <section aria-label="Мои публикации" className="space-y-3">
            <SectionHeading
              title="Мои публикации"
              hint="портфолио: книги, статьи, треки, курсы"
            />
            <PublicationsSection />
          </section>

          <section aria-label="Тарифы студии" className="space-y-3">
            <SectionHeading
              title="Тарифы студии"
              hint="продажа доступа к студии"
            />
            <PricingTiers />
          </section>

          <section aria-label="Способы выплат" className="space-y-3">
            <SectionHeading title="Способы выплат" />
            <PayoutsSection />
          </section>

          <WipBanner
            title="Скоро: приём платежей"
            description="Приём платежей подключается после релиза публичной версии"
            features={["ЮKassa", "Boosty", "Gumroad", "крипта"]}
          />
        </div>
      </div>
    </section>
  );
}
