"use client";

/**
 * StoryboardPanes (7-b) — листовые панели студии раскадровки, вынесенные
 * из storyboard-workspace.tsx ради лимита строк: чипы сценариев, ошибка
 * загрузки и пустые состояния (нет сценария / нет сцен / нечего смотреть).
 * Вся логика остаётся в воркспейсе — сюда приходят только колбэки.
 */

import {
  Clapperboard,
  Film,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DocumentDto } from "@/lib/workspace-types";

/* ── Чипы сценариев раскадровки + «Добавить сцену» ── */

export function ScriptChipsBar({
  scripts,
  scriptId,
  onSelect,
  onAddScene,
  addingScene,
}: {
  scripts: DocumentDto[] | null;
  scriptId: string | null;
  onSelect: (id: string) => void;
  onAddScene: () => void;
  addingScene: boolean;
}) {
  return (
    <div className="shrink-0 border-b bg-muted/30 px-4 py-2.5 sm:px-6">
      <div className="flex min-w-0 items-center gap-1.5">
        <Film className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {scripts === null ? (
          <div className="flex flex-1 gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-7 w-32 rounded-full" />
            ))}
          </div>
        ) : (
          <div className="vf-scroll-x flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {scripts.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => onSelect(doc.id)}
                aria-current={scriptId === doc.id}
                title={doc.title}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                  scriptId === doc.id
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                )}
              >
                <span className="truncate">{doc.title}</span>
              </button>
            ))}
          </div>
        )}
        {scriptId ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
            onClick={onAddScene}
            disabled={addingScene}
            aria-label="Добавить сцену в сценарий"
          >
            {addingScene ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="size-3.5" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Добавить сцену</span>
            <span className="sm:hidden">Сцена</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/* ── Ошибка загрузки воркспейса ── */

export function LoadErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden="true" />
        Повторить
      </Button>
    </div>
  );
}

/* ── Нет сценария раскадровки — создание ── */

export function NoScriptCard({
  creating,
  onCreate,
}: {
  creating: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed p-8 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Clapperboard className="size-6" />
        </span>
        <div>
          <h2 className="text-base font-semibold">
            Создать сценарий раскадровки
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Сценарий — это список сцен. В каждой сцене: текст для диктора,
            сгенерированный кадр и озвучка. Из них плеер соберёт фильм.
          </p>
        </div>
        <Button onClick={onCreate} disabled={creating}>
          {creating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          Создать сценарий
        </Button>
      </div>
    </div>
  );
}

/* ── В сценарии нет ни одной сцены ── */

export function NoScenesCard({
  adding,
  onAdd,
}: {
  adding: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">
        В сценарии пока нет ни одной сцены
      </p>
      <Button size="sm" variant="outline" onClick={onAdd} disabled={adding}>
        {adding ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
        Добавить сцену
      </Button>
    </div>
  );
}

/* ── Плеер пуст: нет ни кадра, ни озвучки ── */

export function NoPlayableCard() {
  return (
    <div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-card/50 px-6 text-center">
      <Clapperboard
        className="size-5 text-muted-foreground/50"
        aria-hidden="true"
      />
      <p className="text-xs text-muted-foreground">
        Пока нечего смотреть — сгенерируйте кадр или озвучку любой сцены
      </p>
    </div>
  );
}
