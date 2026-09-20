"use client";

/**
 * Pipeline — «Один конвейер — весь путь».
 * Идея → Создание → Монетизация: three big cards joined by animated arrow
 * chips (vertical on mobile, horizontal with gradient dashes on desktop).
 */

import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Coins,
  MessageSquareText,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { Reveal, SectionHeader } from "@/components/landing/landing-shared";
import { LANDING_PIPELINE_MONETIZE } from "@/lib/landing-copy";

const STEPS: {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    step: "1",
    icon: MessageSquareText,
    title: "Идея",
    description:
      "Опишите мысль словами или голосом — оркестратор поймёт контекст.",
  },
  {
    step: "2",
    icon: Wand2,
    title: "Создание",
    description:
      "Тексты, иллюстрации, треки, видео и код приложения рождаются в одном диалоге.",
  },
  {
    step: "3",
    icon: Coins,
    title: "Монетизация",
    description: LANDING_PIPELINE_MONETIZE,
  },
];

export function PipelineSection() {
  return (
    <section className="border-t bg-secondary/40">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeader
          overline="Конвейер"
          title="Один конвейер — весь путь"
          description="Никаких переключений между десятком сервисов: каждый шаг от замысла до дохода живёт в одном окне."
        />
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-2">
          <PipelineStep {...STEPS[0]} delay={0} />
          <PipelineArrow />
          <PipelineStep {...STEPS[1]} delay={0.1} />
          <PipelineArrow />
          <PipelineStep {...STEPS[2]} delay={0.2} />
        </div>
      </div>
    </section>
  );
}

function PipelineStep({
  step,
  icon: Icon,
  title,
  description,
  delay,
}: {
  step: string;
  icon: LucideIcon;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="flex h-full flex-col gap-4 rounded-2xl border bg-card p-6 transition-colors duration-200 hover:border-primary/40 sm:p-7">
        <div className="flex items-center justify-between">
          <span className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
            <Icon className="size-6" aria-hidden="true" />
          </span>
          <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {step}
          </span>
        </div>
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

/** Arrow chip between steps — bobs gently, direction follows the layout. */
function PipelineArrow() {
  return (
    <div
      className="flex items-center justify-center gap-1 py-2 lg:py-0"
      aria-hidden="true"
    >
      <span className="hidden h-px w-5 bg-primary/30 lg:block" />
      <motion.span
        animate={{ x: [0, 4, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="hidden size-10 items-center justify-center rounded-full border bg-card text-primary shadow-sm lg:flex"
      >
        <ArrowRight className="size-4" />
      </motion.span>
      <motion.span
        animate={{ y: [0, 4, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="flex size-10 items-center justify-center rounded-full border bg-card text-primary shadow-sm lg:hidden"
      >
        <ArrowDown className="size-4" />
      </motion.span>
      <span className="hidden h-px w-5 bg-primary/30 lg:block" />
    </div>
  );
}
