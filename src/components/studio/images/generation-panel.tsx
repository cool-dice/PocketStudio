"use client";

import { useState } from "react";
import { Minus, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SelectableChip } from "./chip";
import { IMAGE_STYLES, RATIOS, SAMPLE_PROMPTS, type ImageRatio } from "./gallery-data";

const COUNTS = [1, 2, 4];

/**
 * Верхняя панель генерации: промпт + быстрые идеи,
 * пресеты стиля, формат, количество и кнопка «Сгенерировать».
 */
export function GenerationPanel({
  onGenerate,
}: {
  onGenerate: (prompt: string, style: string, ratio: ImageRatio, count: number) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<string>(IMAGE_STYLES[0]);
  const [ratio, setRatio] = useState<ImageRatio>("1:1");
  const [countIndex, setCountIndex] = useState(0);
  const count = COUNTS[countIndex] ?? 1;

  const stepCount = (dir: 1 | -1) =>
    setCountIndex((i) => (i + dir + COUNTS.length) % COUNTS.length);

  return (
    <section
      aria-label="Панель генерации"
      className="shrink-0 rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
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

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">Стиль</span>
          {IMAGE_STYLES.map((s) => (
            <SelectableChip
              key={s}
              label={s}
              selected={style === s}
              onClick={() => setStyle(s)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Формат</span>
          <div
            className="inline-flex items-center rounded-lg bg-muted p-0.5"
            role="group"
            aria-label="Соотношение сторон"
          >
            {RATIOS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRatio(r)}
                aria-current={ratio === r ? "true" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors",
                  ratio === r
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Кол-во</span>
          <div className="inline-flex items-center rounded-lg border">
            <button
              type="button"
              onClick={() => stepCount(-1)}
              aria-label="Уменьшить количество изображений"
              className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <Minus className="size-3.5" aria-hidden="true" />
            </button>
            <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
              {count}
            </span>
            <button
              type="button"
              onClick={() => stepCount(1)}
              aria-label="Увеличить количество изображений"
              className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <Button className="ml-auto shrink-0" onClick={() => onGenerate(prompt, style, ratio, count)}>
          <Sparkles className="size-4" aria-hidden="true" />
          Сгенерировать
        </Button>
      </div>
    </section>
  );
}
