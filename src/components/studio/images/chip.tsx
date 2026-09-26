"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Маленькая «пилюля»-переключатель для одинарного выбора
 * (размеры, фильтры, воркспейсы, быстрые идеи).
 */
export function SelectableChip({
  label,
  selected,
  onClick,
  icon: Icon,
  count,
  hint,
  className,
  disabled,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  icon?: LucideIcon;
  /** Фасетный счётчик (показывается бейджем). */
  count?: number;
  /** Подпись под ярлыком (напр. разрешение пресета). */
  hint?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={selected ? "true" : undefined}
      title={hint}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        selected
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-50 hover:border-border",
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
      <span className="truncate">{label}</span>
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
