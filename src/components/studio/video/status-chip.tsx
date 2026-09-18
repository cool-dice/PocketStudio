import { cn } from "@/lib/utils";

/**
 * Compact status chip shared by the scene strip, shot list and elsewhere.
 * `active` is the «in progress» amber tone with a pulsing dot.
 */

export type ChipTone = "done" | "active" | "pending";

const TONES: Record<
  ChipTone,
  { chip: string; dot: string; pulse: boolean }
> = {
  done: {
    chip:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
    dot: "bg-emerald-500 dark:bg-emerald-400",
    pulse: false,
  },
  active: {
    chip:
      "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:text-amber-400",
    dot: "bg-amber-500 dark:bg-amber-400",
    pulse: true,
  },
  pending: {
    chip: "border-border bg-muted/60 text-muted-foreground",
    dot: "bg-muted-foreground/50",
    pulse: false,
  },
};

export function StatusChip({
  tone,
  label,
  className,
}: {
  tone: ChipTone;
  label: string;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
        t.chip,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          t.dot,
          t.pulse && "animate-pulse",
        )}
      />
      {label}
    </span>
  );
}
