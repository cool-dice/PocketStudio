"use client";

/**
 * Hero — «Студия, которая помещается в карман».
 * Centered pitch (early-access badge, headline, sub, CTAs, honest note)
 * with a floating dock below the text: orchestrator core pill + five
 * module tiles (docs, images, audio, video, launch) on gentle y-oscillation
 * loops, low-opacity ring shadows, tasteful rotations and offsets.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import {
  AudioWaveform,
  Clapperboard,
  Film,
  ImagePlus,
  ScrollText,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { fadeUp } from "@/components/landing/landing-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LANDING_HERO_SUB,
  LANDING_LAUNCH_CAPTION,
  landingCtaHref,
  landingHeroNote,
} from "@/lib/landing-copy";
import { cn } from "@/lib/utils";

export function HeroSection({
  firstUserBecomesAdmin = false,
}: {
  firstUserBecomesAdmin?: boolean;
}) {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* soft emerald wash behind the whole hero */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[32rem] bg-gradient-to-b from-primary/[0.07] to-transparent"
        aria-hidden="true"
      />

      <div className="flex flex-col items-center py-14 text-center lg:py-24">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center gap-5"
        >
          <Badge
            variant="outline"
            className="gap-1.5 rounded-full border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400"
          >
            <Sparkles className="size-3" aria-hidden="true" />
            Ранний доступ
          </Badge>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Киностудия{" "}
            <span className="text-primary">от А до Я</span>
          </h1>
          <p className="max-w-xl text-pretty text-muted-foreground sm:text-lg">
            {LANDING_HERO_SUB}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={landingCtaHref("register")}>
                <Sparkles className="size-4" aria-hidden="true" />
                Начать бесплатно
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                document
                  .getElementById("how-it-works")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Как это работает
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {landingHeroNote(firstUserBecomesAdmin)}
          </p>
        </motion.div>

        <HeroTileDock />
      </div>
    </section>
  );
}

/* ── Floating module dock below the pitch ── */

function HeroTileDock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
      className="relative mt-8 w-full max-w-5xl sm:mt-12"
      aria-hidden="true"
    >
      {/* soft glow under the dock */}
      <div className="absolute top-1/2 left-1/2 -z-10 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl sm:size-96" />

      {/* orchestrator core pill */}
      <div className="flex justify-center pb-6 sm:pb-8">
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{
            duration: 4.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="flex items-center gap-2.5 rounded-2xl border border-primary/25 bg-card/95 px-4 py-3 shadow-lg shadow-primary/10 backdrop-blur"
        >
          <span className="relative flex size-9 shrink-0 items-center justify-center">
            <motion.span
              className="absolute inset-0 rounded-xl bg-primary/40"
              animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
            <span className="relative flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
          </span>
          <span className="text-left">
            <span className="block text-sm leading-tight font-semibold">
              Оркестратор
            </span>
            <span className="block text-[11px] leading-tight text-muted-foreground">
              держит весь контекст
            </span>
          </span>
        </motion.div>
      </div>

      {/* five studio-module tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-5">
        <FloatTile
          icon={ScrollText}
          label="Сценарий"
          caption="замысел и реплики"
          className="lg:-rotate-2 lg:-translate-y-2"
          duration={4.2}
        />
        <FloatTile
          icon={ImagePlus}
          label="Кадры"
          caption="раскадровка и концепты"
          className="lg:rotate-2 lg:translate-y-3"
          duration={5}
          delay={0.6}
        />
        <FloatTile
          icon={AudioWaveform}
          label="Озвучка"
          caption="речь и саундтрек"
          className="lg:-translate-y-1"
          duration={4.4}
          delay={1.1}
        />
        <FloatTile
          icon={Clapperboard}
          label="Монтаж"
          caption="сцены и трейлер"
          className="lg:-rotate-1 lg:translate-y-3"
          duration={5.2}
          delay={0.3}
        />
        <FloatTile
          icon={Film}
          label="Выпуск"
          caption={LANDING_LAUNCH_CAPTION}
          className="col-span-2 sm:col-span-1 lg:rotate-1 lg:-translate-y-2"
          duration={4.6}
          delay={0.9}
        />
      </div>
    </motion.div>
  );
}

function FloatTile({
  icon: Icon,
  label,
  caption,
  className,
  duration,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  caption: string;
  className?: string;
  duration: number;
  delay?: number;
}) {
  return (
    <div className={cn("flex justify-center", className)}>
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-full w-full flex-col items-center gap-2.5 rounded-xl border bg-card/90 p-4 shadow-lg shadow-primary/[0.06] ring-1 ring-primary/10 backdrop-blur sm:gap-3 sm:p-5"
      >
        <span className="flex size-11 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/5 text-primary sm:size-12">
          <Icon className="size-5 sm:size-6" />
        </span>
        <span className="text-center">
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{caption}</span>
        </span>
      </motion.div>
    </div>
  );
}
