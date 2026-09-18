"use client";

/**
 * Monetize (5-c) — карточка «План монетизации».
 *
 * Три состояния: пустое (бриф + «Собрать план»), сборка (LLM ~15–25 сек,
 * скелетон со спиннером) и готовый план из секций документ-плана:
 * концепция, продукты с ценами-бейджами, каналы, шаги-чеклист по срокам.
 * «Пересобрать» — AlertDialog с брифом (регенерация заменяет документ).
 */

import { useEffect, useState } from "react";
import {
  Lightbulb,
  Loader2,
  Megaphone,
  Package,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentDto } from "@/lib/workspace-types";
import {
  briefFromDocument,
  type MonetizePlan,
  sectionText,
} from "./plan-data";

const BRIEF_PLACEHOLDER =
  "Например: EP из 4 треков для стримингов, обложка и клип уже есть";

export function PlanCard({
  planDoc,
  plan,
  generating,
  onGenerate,
}: {
  planDoc: DocumentDto | null;
  plan: MonetizePlan | null;
  generating: boolean;
  /** Запустить сборку плана (первую или повторную) с брифом. */
  onGenerate: (brief: string) => void;
}) {
  const [brief, setBrief] = useState("");
  const [regenBrief, setRegenBrief] = useState("");

  /* Префилл брифа регенерации из description план-документа. */
  useEffect(() => {
    setRegenBrief(briefFromDocument(planDoc));
  }, [planDoc]);

  return (
    <section
      aria-label="План монетизации"
      className="rounded-xl border bg-card shadow-sm"
    >
      {generating ? <GeneratingState /> : null}

      {!generating && !planDoc ? (
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <Sparkles className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Соберите план монетизации</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Модель изучит воркспейс — название, тип, стадию и готовые
                артефакты — и предложит продукты, каналы, шаги запуска и
                прогноз дохода. План сохранится документом в этом воркспейсе.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="monetize-brief"
              className="text-xs font-medium text-muted-foreground"
            >
              Бриф (необязательно)
            </label>
            <Textarea
              id="monetize-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={BRIEF_PLACEHOLDER}
              rows={3}
              className="resize-none"
              maxLength={2000}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => onGenerate(brief.trim())}>
              <Sparkles className="size-4" aria-hidden="true" />
              Собрать план
            </Button>
            <p className="text-xs text-muted-foreground">
              Занимает 15–25 секунд
            </p>
          </div>
        </div>
      ) : null}

      {!generating && planDoc ? (
        <div className="flex flex-col gap-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{planDoc.title}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Собран студией · обновлён{" "}
                {new Date(planDoc.updatedAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <RegenerateDialog
              brief={regenBrief}
              onBriefChange={setRegenBrief}
              onRegenerate={() => onGenerate(regenBrief.trim())}
            />
          </div>

          {plan ? (
            <>
              {plan.concept ? (
                <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3.5">
                  <Lightbulb
                    className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-relaxed">{plan.concept}</p>
                </div>
              ) : null}

              {plan.products.length > 0 ? (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Package className="size-3.5" aria-hidden="true" />
                    Продукты и цены
                  </h3>
                  <ul className="grid gap-2.5 sm:grid-cols-2">
                    {plan.products.map((p) => (
                      <li
                        key={p.name}
                        className="flex flex-col gap-1.5 rounded-lg border bg-background/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-snug">
                            {p.name}
                          </p>
                          {p.price ? (
                            <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              {p.price}
                            </span>
                          ) : null}
                        </div>
                        {p.note ? (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {p.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {plan.channels.length > 0 ? (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Megaphone className="size-3.5" aria-hidden="true" />
                    Каналы
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {plan.channels.map((c) => (
                      <li
                        key={c.name}
                        className="rounded-lg border bg-background/60 p-3"
                      >
                        <p className="text-sm font-medium leading-snug">
                          {c.name}
                        </p>
                        {c.note ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {c.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {plan.steps.length > 0 ? (
                <div>
                  <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    План запуска
                  </h3>
                  <ol className="flex flex-col gap-2">
                    {plan.steps.map((s, i) => (
                      <li
                        key={`${s.term}-${i}`}
                        className="flex items-start gap-3 rounded-lg border bg-background/60 p-3"
                      >
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          {s.term ? (
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                              {s.term}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-sm leading-relaxed">
                            {s.note}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {!plan.concept &&
              plan.products.length === 0 &&
              plan.channels.length === 0 &&
              plan.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  План пуст — пересоберите его кнопкой выше.
                </p>
              ) : null}
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {planDoc.sections?.length
                ? planDoc.sections.map((s) => sectionText(s.content)).join("\n\n")
                : "Секции плана пусты — пересоберите план."}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Состояние сборки: спиннер + пульсирующие скелетоны. */
function GeneratingState() {
  return (
    <div
      className="flex flex-col gap-4 p-4 sm:p-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2.5 text-sm font-medium">
        <Loader2 className="size-4 animate-spin text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        Модель собирает план монетизации…
      </div>
      <p className="text-xs text-muted-foreground">
        Обычно 15–25 секунд. Не закрывайте вкладку.
      </p>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-4 w-3/4" />
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/** «Пересобрать» с подтверждением и брифом. */
function RegenerateDialog({
  brief,
  onBriefChange,
  onRegenerate,
}: {
  brief: string;
  onBriefChange: (value: string) => void;
  onRegenerate: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <RefreshCw className="size-4" aria-hidden="true" />
          Пересобрать
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Пересобрать план монетизации?</AlertDialogTitle>
          <AlertDialogDescription>
            Модель соберёт новый план по текущим данным воркспейса — текущий
            план будет заменён. Можно уточнить бриф перед запуском.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="monetize-regen-brief"
            className="text-xs font-medium text-muted-foreground"
          >
            Бриф (необязательно)
          </label>
          <Textarea
            id="monetize-regen-brief"
            value={brief}
            onChange={(e) => onBriefChange(e.target.value)}
            placeholder={BRIEF_PLACEHOLDER}
            rows={3}
            className="resize-none"
            maxLength={2000}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onRegenerate}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Пересобрать
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
