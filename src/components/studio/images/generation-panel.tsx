"use client";

/**
 * GenerationPanel (A2-c) — РЕАЛЬНАЯ генерация изображений.
 * Промпт + название + 5 пресетов размера («Квадрат/Альбом/Книжная/
 * Широкая/Вертикальная») → api.aiGenerateImage (≈30–45 сек).
 * На время запроса: кнопка disabled + прогресс-плашка «Студия рисует…»
 * с таймером и пульсирующей полосой; результат приходит в галерею
 * через onCreated (первой карточкой).
 */

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SelectableChip } from "./chip";
import {
  IMAGE_SIZE_PRESETS,
  SAMPLE_PROMPTS,
} from "./gallery-data";

export interface GenerationRequest {
  prompt: string;
  title: string;
  size: string;
}

export function GenerationPanel({
  projectId,
  busy,
  generating,
  onGenerate,
}: {
  /** Воркспейс, в который генерируем (null — глобальный экран без выбора). */
  projectId: string | null;
  /** Идёт ли генерация прямо сейчас. */
  busy: boolean;
  /** Что сейчас рисует студия (для плашки и плитки-заглушки). */
  generating: { prompt: string; sizeLabel: string } | null;
  onGenerate: (request: GenerationRequest) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [sizeId, setSizeId] = useState(IMAGE_SIZE_PRESETS[0].id);
  const [elapsed, setElapsed] = useState(0);

  const preset =
    IMAGE_SIZE_PRESETS.find((p) => p.id === sizeId) ?? IMAGE_SIZE_PRESETS[0];
  const canGenerate =
    !busy && projectId !== null && prompt.trim().length >= 3;

  // Таймер плашки: сколько секунд студия уже рисует (сброс — в submit).
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy]);

  const submit = () => {
    if (!canGenerate) return;
    setElapsed(0);
    onGenerate({ prompt: prompt.trim(), title: title.trim(), size: preset.id });
  };

  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <section
      aria-label="Панель генерации"
      className="shrink-0 rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor="image-prompt" className="text-sm font-medium">
          Промпт
        </label>
        <span className="text-xs text-muted-foreground">
          Словами — остальное сделает стилист
        </span>
      </div>
      <Textarea
        id="image-prompt"
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="Опишите изображение: „неоновый город на закате в стиле киберпанк-акварели“…"
        className="mt-2 resize-none"
      />

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Идеи:</span>
        {SAMPLE_PROMPTS.map((s) => (
          <SelectableChip
            key={s.label}
            label={s.label}
            selected={prompt === s.prompt}
            onClick={() => setPrompt(prompt === s.prompt ? "" : s.prompt)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 border-t pt-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Размер
          </span>
          <div
            className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5"
            role="group"
            aria-label="Размер изображения"
          >
            {IMAGE_SIZE_PRESETS.map((p) => (
              <SelectableChip
                key={p.id}
                label={p.label}
                hint={p.size}
                selected={sizeId === p.id}
                onClick={() => setSizeId(p.id)}
                className={cn(sizeId === p.id && "tabular-nums")}
              />
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <label
            htmlFor="image-title"
            className="shrink-0 text-xs font-medium text-muted-foreground"
          >
            Название
          </label>
          <Input
            id="image-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="необязательно"
            className="h-8 flex-1 text-xs sm:max-w-52"
          />
        </div>

        <Button
          className="shrink-0 lg:ml-auto"
          onClick={submit}
          disabled={!canGenerate}
          aria-live="polite"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-4" aria-hidden="true" />
          )}
          {busy ? "Студия рисует…" : "Сгенерировать"}
        </Button>
      </div>

      {/* Прогресс-плашка: AI-генерация занимает ~30–45 секунд */}
      {busy && generating ? (
        <div
          role="status"
          aria-live="polite"
          className="mt-3 overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.06]"
        >
          <div className="flex items-center gap-3 px-3.5 py-3">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
              aria-hidden="true"
            >
              <Sparkles className="size-4 animate-pulse" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                Студия рисует…{" "}
                <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
                  {elapsedLabel}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                «{generating.prompt}» · {generating.sizeLabel} · обычно это занимает 30–45 секунд
              </p>
            </div>
          </div>
          <div className="h-1 w-full overflow-hidden bg-primary/10">
            <div className="h-full w-1/3 animate-pulse bg-primary/50" />
          </div>
        </div>
      ) : null}

      {projectId === null ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Выберите воркспейс выше — генерация привязана к его галерее.
        </p>
      ) : null}
    </section>
  );
}
