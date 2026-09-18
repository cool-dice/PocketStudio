"use client";

/**
 * How it works — three steps from empty screen to published work,
 * plus the final CTA band that closes the page.
 */

import { ArrowRight } from "lucide-react";

import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Reveal, SectionHeader } from "@/components/landing/landing-shared";

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
      "Тексты, картинки, звук, видео и код приложения появляются в одном окне.",
  },
  {
    step: "3",
    title: "Опубликуйте и получайте доход",
    description:
      "Книга, курс или приложение уходят к читателям — выплаты видны прямо в студии.",
  },
] as const;

export function HowItWorksSection({ onRegister }: { onRegister: () => void }) {
  return (
    <>
      <section id="how-it-works" className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <SectionHeader
            overline="Быстрый старт"
            title="Как это работает"
            description="Три шага от пустого экрана до опубликованной работы — всё внутри одного диалога."
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
              Готовы выпустить первую работу из кармана?
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="max-w-md text-pretty text-muted-foreground">
              Регистрация занимает минуту — студия уже ждёт первую идею.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <Button size="lg" onClick={onRegister}>
              Создать аккаунт
              <ArrowRight className="size-4" aria-hidden="true" />
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
