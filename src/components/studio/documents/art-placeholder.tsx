"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Общий градиентный «артворк» для NarrativeCore: портреты персонажей
 * и иллюстрации альбома. Точечная сетка, мягкий свет и водяной знак —
 * без внешних изображений, безопасно для тёмной темы.
 */

const DOT_PATTERN_STYLE: React.CSSProperties = {
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1px)",
  backgroundSize: "12px 12px",
};

export function GradientArt({
  gradient,
  icon: Icon,
  initials,
  className,
  iconClassName,
  children,
  ariaLabel,
}: {
  gradient: string;
  icon?: LucideIcon;
  initials?: string;
  className?: string;
  iconClassName?: string;
  children?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <div
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      className={cn("relative overflow-hidden", className)}
      style={{ background: gradient }}
    >
      <div className="absolute inset-0" style={DOT_PATTERN_STYLE} aria-hidden="true" />
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/40"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        {initials ? (
          <span className="select-none font-serif text-5xl font-semibold text-white/40">
            {initials}
          </span>
        ) : Icon ? (
          <Icon className={cn("size-12 text-white/25", iconClassName)} />
        ) : null}
      </div>
      {children}
    </div>
  );
}
