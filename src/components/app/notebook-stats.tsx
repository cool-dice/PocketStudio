"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export function NotebookStats({
  onDueClick,
}: {
  dueReminders?: number;
  onDueClick?: () => void;
}) {
  const [days, setDays] = useState<{ date: string; total: number }[]>([]);
  const [due, setDue] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .notesStats()
      .then((r) => {
        if (!cancelled) {
          setDays(r.days);
          setDue(r.dueReminders);
        }
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const max = Math.max(1, ...days.map((d) => d.total));

  if (days.length === 0 && due === 0) return null;

  return (
    <div className="flex items-center gap-3 border-b px-3 py-2 sm:px-4">
      <div
        className="flex h-8 flex-1 items-end gap-0.5"
        aria-label="Активность заметок за 14 дней"
      >
        {days.map((d) => (
          <span
            key={d.date}
            title={`${d.date}: ${d.total}`}
            className={cn(
              "min-w-0 flex-1 rounded-sm bg-emerald-500/70",
              d.total === 0 && "bg-muted",
            )}
            style={{ height: `${Math.max(8, (d.total / max) * 100)}%` }}
          />
        ))}
      </div>
      {due > 0 ? (
        <button
          type="button"
          onClick={onDueClick}
          className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-800 dark:text-amber-200"
        >
          Напоминания: {due}
        </button>
      ) : null}
    </div>
  );
}
