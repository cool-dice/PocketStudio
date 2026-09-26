"use client";

/**
 * Modules — «Всё творчество — в одном окне».
 * Nine studio module cards: icon in an emerald-soft gradient tile,
 * title, one-line description; gentle lift + emerald border on hover.
 */

import {
  AudioWaveform,
  Blocks,
  BookOpenText,
  Clapperboard,
  Coins,
  ImagePlus,
  PenTool,
  Wand2,
  type LucideIcon,
} from "lucide-react";

import { Reveal, SectionHeader } from "@/components/landing/landing-shared";
import {
  LANDING_MCP_BLURB,
  LANDING_MONETIZE_BLURB,
} from "@/lib/landing-copy";
import {
  AUDIO_LANDING_BLURB,
  DESIGN_LANDING_BLURB,
  VIDEO_LANDING_BLURB,
} from "@/lib/studio-copy";

const MODULES: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: BookOpenText,
    title: "Документы",
    description: "Сценарии, синопсисы и исходные тексты со структурой глав и ИИ-редактором.",
  },
  {
    icon: ImagePlus,
    title: "Изображения",
    description: "Раскадровка, концепты и постеры по текстовому описанию.",
  },
  {
    icon: PenTool,
    title: "Дизайн",
    description: DESIGN_LANDING_BLURB,
  },
  {
    icon: AudioWaveform,
    title: "Аудио",
    description: AUDIO_LANDING_BLURB,
  },
  {
    icon: Clapperboard,
    title: "Видео",
    description: VIDEO_LANDING_BLURB,
  },
  {
    icon: Blocks,
    title: "Интеграции",
    description: LANDING_MCP_BLURB,
  },
  {
    icon: Wand2,
    title: "Скиллы",
    description: "Импортируйте и создавайте навыки оркестратора.",
  },
  {
    icon: Coins,
    title: "Монетизация",
    description: LANDING_MONETIZE_BLURB,
  },
];

export function ModulesSection() {
  return (
    <section className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <SectionHeader
          overline="Модули"
          title="Киностудия — в одном окне"
          description="Модули закрывают путь от замысла до выпуска: сценарий, кадры, звук, монтаж и оффер, не выпуская картину из диалога."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module, i) => (
            <ModuleCard
              key={module.title}
              {...module}
              delay={(i % 4) * 0.06}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function ModuleCard({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <Reveal delay={delay} className="h-full">
      <div className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
        <span className="flex size-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary transition-transform duration-200 group-hover:scale-105">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </Reveal>
  );
}
