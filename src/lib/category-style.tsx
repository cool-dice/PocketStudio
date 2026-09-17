"use client";

/**
 * Category visual language — maps the 10 allowlist color keys and 12 allowlist
 * lucide icon names (see lib/note-utils.ts, agent-service tools.ts) to static
 * Tailwind classes and icon components. All class strings are static so the
 * Tailwind JIT compiler picks them up; opacities (/10, /30) keep every color
 * readable in light AND dark mode.
 *
 * CategoryGlyph is a stable module-scope component (the react-hooks
 * static-components rule forbids creating icon components during render).
 */

import {
  Book,
  Brain,
  Briefcase,
  Code,
  Coffee,
  Heart,
  Lightbulb,
  Rocket,
  ShoppingCart,
  Star,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface CategoryColorStyle {
  /** Chip / badge look: soft bg + colored text + tinted border. */
  chip: string;
  /** Solid dot color (works on any background). */
  dot: string;
}

export const CATEGORY_COLORS: Record<string, CategoryColorStyle> = {
  emerald: {
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  amber: {
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  rose: {
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  sky: {
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  violet: {
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  stone: {
    chip: "border-stone-500/30 bg-stone-500/10 text-stone-700 dark:text-stone-300",
    dot: "bg-stone-500",
  },
  teal: {
    chip: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  orange: {
    chip: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  pink: {
    chip: "border-pink-500/30 bg-pink-500/10 text-pink-700 dark:text-pink-300",
    dot: "bg-pink-500",
  },
  cyan: {
    chip: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
};

const FALLBACK_COLOR: CategoryColorStyle = CATEGORY_COLORS.stone;

export function categoryColorStyle(color: string): CategoryColorStyle {
  return CATEGORY_COLORS[color] ?? FALLBACK_COLOR;
}

/** Module-scope icon map (allowlist names → lucide components). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  briefcase: Briefcase,
  "shopping-cart": ShoppingCart,
  heart: Heart,
  brain: Brain,
  zap: Zap,
  star: Star,
  book: Book,
  code: Code,
  rocket: Rocket,
  wallet: Wallet,
  coffee: Coffee,
};

/** Renders a category icon by allowlist name (falls back to a lightbulb). */
export function CategoryGlyph({
  icon,
  className,
}: {
  icon: string;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[icon] ?? Lightbulb;
  return <Icon className={className} aria-hidden="true" />;
}
