"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Маленькая «пилюля»-переключатель для одинарного выбора
 * (жанры, настроения, атмосферы и т. п.).
 * count — компактный бейдж со счётчиком (каталогизация).
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
            "rounded-full px-1.5 py-px text-[10px] font-semibold leading-none tabular-nums",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
