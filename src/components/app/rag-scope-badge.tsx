"use client";

import { Library, Shield } from "lucide-react";

import { cn } from "@/lib/utils";

export function RagScopeBadge({
  scope,
  className,
}: {
  scope: "global" | "workspace";
  className?: string;
}) {
  const workspace = scope === "workspace";
  return (
    <span
      title={
        workspace
          ? "Контекст: только этот воркспейс. Чужой код и канон недоступны."
          : "Контекст: вся студия — канон всех ваших воркспейсов."
      }
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        workspace
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : "border-stone-400/40 bg-stone-500/10 text-stone-700 dark:text-stone-300",
        className,
      )}
    >
      {workspace ? (
        <Shield className="size-3" aria-hidden="true" />
      ) : (
        <Library className="size-3" aria-hidden="true" />
      )}
      {workspace ? "этот воркспейс" : "вся студия"}
    </span>
  );
}
