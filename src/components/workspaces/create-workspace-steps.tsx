"use client";

/**
 * CreateWorkspaceSteps — шаги мастера создания воркспейса (PS-3-a):
 * выбор типа (5 крупных карточек), название с описанием и чипом типа,
 * финальное превью с пайплайном типа. Управление шагами — в диалоге.
 */

import { Check, ChevronRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  WORKSPACE_STAGES,
  WORKSPACE_TYPE_META,
  type WorkspaceType,
} from "@/lib/workspace-data";
import { cn } from "@/lib/utils";

const NAME_MAX = 80;
const DESCRIPTION_MAX = 280;

// ─────────────────────── шаг 1: тип ───────────────────────

export function StepType({
  selected,
  onSelect,
}: {
  selected: WorkspaceType | null;
  onSelect: (type: WorkspaceType) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Выберите, что вы задумали — от типа зависит пайплайн и вкладки.
      </p>
      <div
        className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Тип воркспейса"
      >
        {(Object.keys(WORKSPACE_TYPE_META) as WorkspaceType[]).map((t) => {
          const meta = WORKSPACE_TYPE_META[t];
          const active = selected === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(t)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                active
                  ? "border-primary/60 bg-primary/[0.07] shadow-sm"
                  : "bg-card hover:border-foreground/25 hover:bg-accent/50",
                t === "universal" && "sm:col-span-2",
              )}
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                  meta.gradient,
                )}
                aria-hidden="true"
              >
                <meta.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {meta.label}
                  {active ? (
                    <Check
                      className="size-3.5 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {meta.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────── шаг 2: название ───────────────────────

export function StepName({
  type,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  onEditType,
  onSubmit,
}: {
  type: WorkspaceType;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  onEditType: () => void;
  /** Enter в поле названия → дальше (если имя валидно). */
  onSubmit: (() => void) | undefined;
}) {
  const meta = WORKSPACE_TYPE_META[type];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3 py-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white",
            meta.gradient,
          )}
          aria-hidden="true"
        >
          <meta.icon className="size-3.5" />
        </span>
        <span className="min-w-0 truncate text-sm font-medium">
          Тип: {meta.label}
        </span>
        <button
          type="button"
          onClick={onEditType}
          className="ml-auto shrink-0 text-xs text-primary underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          Изменить тип
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ws-create-name">
          Название <span className="text-primary">*</span>
        </Label>
        <Input
          id="ws-create-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && onSubmit) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Например, «Хроники Долгой Зимы»"
          maxLength={NAME_MAX}
          required
          aria-required="true"
        />
        <p className="text-right text-[11px] tabular-nums text-muted-foreground">
          {name.length}/{NAME_MAX}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ws-create-desc">
          Описание{" "}
          <span className="font-normal text-muted-foreground">— необязательно</span>
        </Label>
        <Textarea
          id="ws-create-desc"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Пара слов о замысле: о чём это и для кого"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          className="resize-none"
        />
      </div>
    </div>
  );
}

// ─────────────────────── шаг 3: превью ───────────────────────

export function StepPreview({
  type,
  name,
  description,
}: {
  type: WorkspaceType;
  name: string;
  description: string;
}) {
  const meta = WORKSPACE_TYPE_META[type];
  const stages = WORKSPACE_STAGES[type];

  return (
    <div className="space-y-4">
      {/* Превью-карточка */}
      <div className="flex items-center gap-3.5 rounded-xl border bg-card p-4">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
            meta.gradient,
          )}
          aria-hidden="true"
        >
          <meta.icon className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold" title={name}>
            {name}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {description || meta.hint}
          </p>
          <Badge
            variant="outline"
            title={meta.hint}
            className="mt-1.5 px-2 py-0 text-[10px]"
          >
            {meta.label}
          </Badge>
        </div>
      </div>

      {/* Пайплайн типа */}
      <div className="rounded-xl border bg-card p-4">
        <h3 className="text-sm font-semibold">
          Пайплайн типа «{meta.label}»
        </h3>
        <ol className="mt-3 flex flex-wrap items-center gap-1.5">
          {stages.map((stage, i) => (
            <li key={stage} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  i === 0
                    ? "border-primary/50 bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                {i + 1}. {stage}
              </span>
              {i < stages.length - 1 ? (
                <ChevronRight
                  className="size-3.5 text-muted-foreground/50"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/[0.06] p-2.5 text-xs leading-relaxed text-muted-foreground">
          <Sparkles
            className="mt-0.5 size-3.5 shrink-0 text-primary"
            aria-hidden="true"
          />
          Оркестратор предложит план при первом открытии — начнём со
          стадии «{stages[0]}».
        </p>
      </div>
    </div>
  );
}
