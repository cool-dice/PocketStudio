"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Маленькая «пилюля»-переключатель для одинарного выбора
 * (категории кодекса, роли персонажей, типы альбома и т. п.).
 */
export function SelectableChip({
  label,
  selected,
  onClick,
  icon: Icon,
  count,
  className,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
      {label}
      {typeof count === "number" ? (
        <span
          className={cn(
            "rounded-full px-1 text-[10px] tabular-nums leading-4",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

/** Крошечный чип-ссылка на сущность (связи, главы). */
export function MiniChip({
  children,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
}) {
  const base = cn(
    "inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground transition-colors",
    onClick && "cursor-pointer hover:border-primary/40 hover:text-primary",
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={title} className={base}>
        {children}
      </button>
    );
  }
  return (
    <span title={title} className={base}>
      {children}
    </span>
  );
}
