"use client";

import { Clapperboard, PenLine, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { SCRIPT, type SceneCard } from "./video-data";

const WHO_STYLE: Record<string, string> = {
  ЛИСА: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400",
  ПИКСЕЛЬ:
    "border-stone-400/40 bg-stone-400/10 text-stone-600 dark:border-stone-500/40 dark:bg-stone-500/10 dark:text-stone-300",
};

/**
 * Таб «Сценарий»: описание активной сцены, диалог с бейджами
 * персонажей и заметка режиссёра.
 */
export function ScriptTab({ scene }: { scene: SceneCard }) {
  return (
    <div className="space-y-4 text-sm">
      <header className="rounded-xl border bg-background/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <Clapperboard
              className="size-3.5 text-primary"
              aria-hidden="true"
            />
            Сцена {String(scene.id).padStart(2, "0")}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            <Timer className="size-3.5" aria-hidden="true" />
            {scene.duration}с
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold leading-snug">
          {SCRIPT.title}
        </p>
      </header>

      <section aria-label="Описание сцены">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Описание
        </h3>
        <p className="mt-1.5 font-serif text-sm leading-relaxed text-foreground/90">
          {SCRIPT.description}
        </p>
      </section>

      <section aria-label="Диалог">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Диалог
        </h3>
        <ul className="mt-2 space-y-2">
          {SCRIPT.dialogue.map((line, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 inline-flex w-[4.75rem] shrink-0 justify-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
                  WHO_STYLE[line.who],
                )}
              >
                {line.who}
              </span>
              <p className="min-w-0 flex-1 leading-relaxed text-foreground/90">
                {line.text}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <aside className="rounded-r-md border-l-2 border-primary bg-primary/[0.06] py-2 pl-3 pr-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Заметка режиссёра
        </h3>
        <p className="mt-1 text-sm italic leading-relaxed text-foreground/80">
          {SCRIPT.directorNote}
        </p>
      </aside>

      <Button variant="outline" size="sm" className="w-full">
        <PenLine aria-hidden="true" />
        Редактировать сценарий
      </Button>
    </div>
  );
}
