"use client";

/**
 * Shared motion + layout primitives for the landing page sections.
 * fadeUp — mount-time reveal (hero). Reveal — scroll-triggered, plays once.
 * SectionHeader — the consistent section head: emerald overline + H2 + sub.
 */

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/** Mount-time fade-up spread (used with {...fadeUp}). */
export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
} as const;

/** Scroll reveal — plays once when the block enters the viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Tag to render — "li" keeps list semantics inside <ul>/<ol>. */
  as?: "div" | "li";
}) {
  const Comp = as === "li" ? motion.li : motion.div;
  return (
    <Comp
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </Comp>
  );
}

/** Landing section header: small emerald overline + H2 + muted sub. */
export function SectionHeader({
  overline,
  title,
  description,
  className,
}: {
  overline: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <Reveal className={cn("mb-10 max-w-2xl", className)}>
      <p className="text-xs font-medium tracking-wider text-primary uppercase">
        {overline}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
        {title}
      </h2>
      <p className="mt-3 text-pretty text-muted-foreground">{description}</p>
    </Reveal>
  );
}
