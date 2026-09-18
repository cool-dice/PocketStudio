"use client";

/**
 * Env vars card — KEY=•••••••• rows with reveal/copy actions.
 * Pure visual mock: values are decorative.
 */

import { useState } from "react";
import { Eye, EyeOff, Lock, Plus, Vault } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ENV_VARS, ENV_VARS_TOTAL } from "./deploy-data";
import { CopyButton, SectionCard } from "./deploy-bits";
import { cn } from "@/lib/utils";

export function EnvVarsCard() {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <SectionCard
      icon={Vault}
      title="Переменные окружения"
      sub="production · подставляются в docker compose при деплое"
      action={
        <>
          <span className="hidden rounded-full bg-muted px-2.5 py-0.5 text-[11px] tabular-nums text-muted-foreground sm:inline-flex">
            {ENV_VARS_TOTAL} переменных
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Lock className="size-3" aria-hidden="true" />
            секреты зашифрованы
          </span>
        </>
      }
    >
      <ul className="flex flex-col gap-1.5">
        {ENV_VARS.map((v) => {
          const open = revealed[v.key] ?? false;
          return (
            <li
              key={v.key}
              className="flex items-center gap-2 rounded-lg border bg-background/70 px-3 py-2"
            >
              <span className="flex min-w-0 flex-1 items-baseline gap-2 font-mono text-xs">
                <code className="shrink-0 font-semibold">{v.key}</code>
                <span className="shrink-0 text-muted-foreground">=</span>
                <code
                  className={cn(
                    "min-w-0 truncate",
                    open ? "text-foreground/80" : "tracking-widest text-muted-foreground",
                  )}
                >
                  {open ? v.value : "••••••••"}
                </code>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setRevealed((prev) => ({ ...prev, [v.key]: !open }))}
                aria-label={open ? `Скрыть значение ${v.key}` : `Показать значение ${v.key}`}
                aria-pressed={open}
              >
                {open ? (
                  <EyeOff className="size-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="size-3.5" aria-hidden="true" />
                )}
              </Button>
              <CopyButton
                text={`${v.key}=${v.value}`}
                label={`Скопировать переменную ${v.key}`}
                className="shrink-0"
              />
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        className="mt-3 w-full border-dashed text-muted-foreground hover:text-foreground"
        aria-label="Добавить переменную окружения"
      >
        <Plus className="size-4" aria-hidden="true" />
        Добавить переменную
      </Button>
    </SectionCard>
  );
}
