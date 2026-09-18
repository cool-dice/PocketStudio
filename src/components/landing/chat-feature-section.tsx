"use client";

/**
 * Chat-first feature — «Диалог — главный пульт».
 * Split: left — value props (context / in-preview edits / voice input),
 * right — a stylized chat mock that sells the concept: user request,
 * two tool cards (video storyboard + generated cover) with ✓/progress
 * states and artifact chips, short assistant reply, typing dots, composer.
 */

import { motion } from "framer-motion";
import {
  ArrowUp,
  Check,
  Clapperboard,
  Coins,
  ImagePlus,
  Layers,
  Loader2,
  Mic,
  MousePointerClick,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { Reveal, SectionHeader } from "@/components/landing/landing-shared";
import { cn } from "@/lib/utils";

const BULLETS: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Layers,
    title: "Контекст всей студии — в одном чате",
    description:
      "Книга, проект и последние правки уже в памяти: не пересказывайте каждый раз заново.",
  },
  {
    icon: MousePointerClick,
    title: "Правки прямо в превью",
    description:
      "Выделите элемент и скажите, что поменять, — студия внесёт изменение сама.",
  },
  {
    icon: Mic,
    title: "Голосом и на ходу",
    description:
      "Надиктуйте мысль на прогулке — она станет главой, треком или раскадровкой.",
  },
];

export function ChatFeatureSection() {
  return (
    <section className="border-t bg-secondary/40">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div>
          <SectionHeader
            overline="Пульт управления"
            title="Диалог — главный пульт"
            description="Не переключайтесь между редакторами, генераторами и хостингом: оркестратор слушает, а модули студии исполняют."
          />
          <ul className="space-y-6">
            {BULLETS.map((bullet, i) => (
              <Reveal as="li" key={bullet.title} delay={0.1 + i * 0.08}>
                <div className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                    <bullet.icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-medium">{bullet.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {bullet.description}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <ChatMock />
      </div>
    </section>
  );
}

/* ── Stylized chat mock ── */

function ChatMock() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-md"
      aria-hidden="true"
    >
      {/* soft emerald glow behind the card */}
      <div className="absolute -inset-3 -z-10 rounded-[2rem] bg-primary/5 blur-2xl sm:-inset-6" />

      <div className="rounded-2xl border bg-card p-4 shadow-lg sm:p-5">
        {/* window chrome: status dot + title */}
        <div className="mb-4 flex items-center gap-2.5 border-b pb-3">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50" />
            <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
          </span>
          <span className="text-sm font-medium">Диалог со студией</span>
          <span className="ml-auto rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary">
            режим «Действовать»
          </span>
        </div>

        <div className="space-y-3">
          {/* user request */}
          <MockRow delay={0.15}>
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                Сделай трейлер для книги — 30 секунд, эмбиент
              </div>
            </div>
          </MockRow>

          {/* tool: storyboard done, frames rendering */}
          <MockRow delay={0.3}>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Clapperboard className="size-3.5" />
              </span>
              <div className="w-full max-w-[85%] rounded-xl rounded-bl-md border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <Check className="size-3.5 shrink-0 text-primary" />
                  Видео · раскадровка 5 сцен готова
                </div>
                <div className="mt-2 flex gap-1">
                  {["1", "2", "3", "4", "5"].map((scene, i) => (
                    <span
                      key={scene}
                      className={cn(
                        "flex h-7 flex-1 items-center justify-center rounded-md text-[9px] font-medium",
                        i < 4
                          ? "bg-primary/15 text-primary/70"
                          : "animate-pulse bg-primary/10 text-primary/50",
                      )}
                    >
                      {scene}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <MockChip icon={Check} label="Сценарий" />
                  <MockChip icon={Loader2} label="Кадры" spin />
                </div>
              </div>
            </div>
          </MockRow>

          {/* tool: cover done */}
          <MockRow delay={0.45}>
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ImagePlus className="size-3.5" />
              </span>
              <div className="w-full max-w-[85%] rounded-xl rounded-bl-md border bg-muted/40 px-3 py-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                  <Check className="size-3.5 shrink-0 text-primary" />
                  Изображение · обложка главы 4 сгенерирована
                </div>
                <div className="mt-2 flex h-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 via-primary/10 to-transparent">
                  <span className="rounded-md bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground">
                    глава 4 · тёмный лес
                  </span>
                </div>
              </div>
            </div>
          </MockRow>

          {/* assistant reply */}
          <MockRow delay={0.6}>
            <div className="flex items-end gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="size-3.5" />
              </span>
              <div className="max-w-[85%] rounded-2xl rounded-bl-md border bg-background px-3.5 py-2 text-sm">
                Раскадровка и обложка готовы, монтаж уже собирается. Показать
                черновик, когда закончит?
              </div>
            </div>
          </MockRow>

          {/* studio keeps working */}
          <div className="flex items-center gap-2 pl-8 text-muted-foreground">
            <span className="vf-dot" />
            <span className="vf-dot" />
            <span className="vf-dot" />
          </div>

          {/* composer */}
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-xs text-muted-foreground">
            <span className="flex-1 truncate">
              Опишите задачу… или / для команд
            </span>
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <ArrowUp className="size-3" />
            </span>
          </div>
        </div>
      </div>

      {/* floating status pills */}
      <motion.div
        className="absolute -top-3 -right-2 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md sm:-right-4"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Clapperboard className="size-3.5 text-primary" />
        Трейлер собирается
      </motion.div>
      <motion.div
        className="absolute -bottom-3 -left-2 flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-md sm:-left-4"
        animate={{ y: [0, 4, 0] }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8,
        }}
      >
        <Coins className="size-3.5 text-primary" />
        Первая продажа
      </motion.div>
    </motion.div>
  );
}

/** Small artifact chip inside a tool card (done ✓ or spinning). */
function MockChip({
  icon: Icon,
  label,
  spin = false,
}: {
  icon: LucideIcon;
  label: string;
  spin?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <Icon
        className={cn("size-3 text-primary", spin && "animate-spin")}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/** One staggered message row inside the mock. */
function MockRow({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
