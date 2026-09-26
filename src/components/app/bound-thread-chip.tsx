"use client";

/**
 * Composer / chat-header chip for a bound studio.
 * The chip opens /w/{id}.
 */

import { FolderGit2 } from "lucide-react";

import type { BoundChip } from "@/lib/composer-binding";
import { useAppUi } from "@/lib/store";
import { cn } from "@/lib/utils";

const CHIP_CLASS =
  "inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary outline-none transition-colors duration-150 hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring/60";

export function BoundThreadChip({
  chip,
  id,
  className,
}: {
  chip: BoundChip;
  id: string;
  className?: string;
}) {
  const openWorkspace = useAppUi((s) => s.openWorkspace);
  const inner = (
    <>
      <FolderGit2 className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{chip.label}</span>
    </>
  );
  if (chip.kind === "workspace" && chip.href) {
    return (
      <a
        href={chip.href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
            return;
          }
          e.preventDefault();
          openWorkspace(id);
        }}
        aria-label={`${chip.label} — открыть`}
        className={cn(CHIP_CLASS, className)}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openWorkspace(id)}
      aria-label={`${chip.label} — открыть`}
      title={chip.label}
      className={cn(CHIP_CLASS, className)}
    >
      {inner}
    </button>
  );
}
