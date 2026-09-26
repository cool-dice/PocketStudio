"use client";

/**
 * Shared chrome for PocketStudio module screens.
 * ModuleHeader — sticky top bar (mobile hamburger, icon, title, stage badge,
 * action slot). StageBadge — roadmap stage marker. WipBanner — explains what
 * is visual mock now and what is coming next.
 */

import type { LucideIcon } from "lucide-react";
import { Menu, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ModuleScreenProps {
  /** Open the mobile (< md) navigation sheet. */
  onOpenMobileNav: () => void;
}

export type ModuleStage = "wip" | "beta" | "soon";

const STAGE_META: Record<
  ModuleStage,
  { label: string; className: string }
> = {
  wip: {
    label: "В разработке",
    className:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  beta: {
    label: "Бета",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  soon: {
    label: "Скоро",
    className: "border-stone-400/40 bg-stone-400/10 text-stone-600 dark:text-stone-400",
  },
};

export function StageBadge({
  stage,
  className,
}: {
  stage: ModuleStage;
  className?: string;
}) {
  const meta = STAGE_META[stage];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        meta.className,
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export function ModuleHeader({
  icon: Icon,
  title,
  description,
  stage,
  onOpenMobileNav,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Бейдж стадии; отсутствует = модель функционален и в продакшн-стадии. */
  stage?: ModuleStage;
  onOpenMobileNav: () => void;
  /** Action buttons rendered on the right (desktop) / below (mobile). */
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Открыть навигацию"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold leading-tight sm:text-xl">
              {title}
            </h1>
            {stage ? <StageBadge stage={stage} /> : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  );
}

/**
 * Banner marking a visual-first zone: the layout is final, generation is next.
 */
export function WipBanner({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features?: string[];
}) {
  return (
    <div className="rounded-xl border border-dashed border-amber-500/50 bg-amber-500/[0.06] p-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        >
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
          {features && features.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {features.map((f) => (
                <li
                  key={f}
                  className="rounded-full border border-amber-500/30 bg-background/70 px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {f}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
