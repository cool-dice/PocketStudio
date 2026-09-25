"use client";

/**
 * How it works — three steps from empty screen to an offer in the studio,
 * plus the final CTA band that closes the page (CTA → `/login?tab=register`).
 */

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Reveal, SectionHeader } from "@/components/landing/landing-shared";
import {
  LANDING_HOW_DESCRIPTION,
  LANDING_HOW_STEP3,
  landingCtaBandNote,
  landingCtaHref,
} from "@/lib/landing-copy";

const STEPS = [
  {
    step: "1",
    title: "Опишите идею в диалоге",
    description:
      "Пара предложений текстом или голосом — без шаблонов, настроек и брифов.",
  },
  {
    step: "2",
    title: "Студия создаёт",
    description:
      "Сценарий, кадры, звук и монтаж появляются в одном окне.",
  },
  {
    step: "3",
    title: "Соберите оффер и следите за кабинетом",
    description: LANDING_HOW_STEP3,
  },
] as const;

export function HowItWorksSection({
  firstUserBecomesAdmin = false,
}: {
  firstUserBecomesAdmin?: boolean;
}) {
  return (
    <>
      <section id="how-it-works" className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeader
            overline="Быстрый старт"
            title="Как это работает"
            description={LANDING_HOW_DESCRIPTION}
          />
          <ol className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <StepCard
                key={step.step}
                step={step.step}
                title={step.title}
                description={step.description}
                delay={i * 0.08}
              />
            ))}
          </ol>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="border-t bg-secondary/40">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:py-20">
          <Reveal>
            <LogoMark className="mx-auto size-12 rounded-xl" />
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Готовы выпустить первый фильм из кармана?
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="max-w-md text-pretty text-muted-foreground">
              {landingCtaBandNote(firstUserBecomesAdmin)}
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <Button size="lg" asChild>
              <Link href={landingCtaHref("register")}>
                Создать аккаунт
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function StepCard({
  step,
  title,
  description,
  delay,
}: {
  step: string;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <Reveal as="li" delay={delay} className="h-full">
      <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-6 transition-colors duration-200 hover:border-primary/40">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {step}
        </span>
        <h3 className="font-semibold leading-snug">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </Reveal>
  );
}
