"use client";

/**
 * Элемент списка библиотеки: основная кнопка с типом, статусом,
 * прогрессом и тегами + отдельная звезда избранного (вне кнопки,
 * чтобы не вкладывать кнопки друг в друга). Плюс заголовок
 * группы-коллекции («Циклы» / «Статьи» / …).
 */

import { Library, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { KIND_META, STATUS_META, formatNumber, pluralRu, type StudioDoc } from "./types";

export function DocCollectionHeader({
  label,
  hint,
  count,
}: {
  label: string;
  hint: string;
  count: number;
}) {
  return (
    <li
      className="flex items-center gap-1.5 px-2 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
    >
      <Library className="size-3 shrink-0 text-primary/70" aria-hidden="true" />
      <span className="truncate">{label}</span>
      <span className="shrink-0 font-mono text-[10px] normal-case tracking-normal text-muted-foreground/60">
        {hint}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground/70">{count}</span>
    </li>
  );
}

export function DocListItem({
  doc,
  active,
  favorite,
  onSelect,
  onToggleFavorite,
}: {
  doc: StudioDoc;
  active: boolean;
  favorite: boolean;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const kind = KIND_META[doc.kind];
  const status = STATUS_META[doc.status];
  const Icon = kind.icon;
  const chapters = doc.chapters?.length ?? 0;

  return (
    <li>
      <div
        className={cn(
          "flex items-start gap-1 rounded-lg border border-transparent transition-colors",
          active ? "border-border bg-accent shadow-xs" : "hover:bg-accent",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(doc.id)}
          aria-current={active ? "true" : undefined}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-2.5 text-left"
        >
          <span className="flex items-start gap-2.5">
            <span
              className={cn(
                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background",
                active ? "border-primary/30 text-primary" : "text-muted-foreground",
              )}
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm", active ? "font-semibold" : "font-medium")}>
                {doc.title}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatNumber(doc.words)} {pluralRu(doc.words, "слово", "слова", "слов")}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-1.5 py-px text-[10px] font-medium",
                    status.className,
                  )}
                >
                  {status.label}
                </span>
              </span>
              {doc.tags.length > 0 ? (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {doc.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border bg-background px-1.5 py-px text-[10px] text-muted-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </span>
              ) : null}
              <span
                className="mt-2 block h-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={doc.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Готовность «${doc.title}» — ${doc.progress}%`}
              >
                <span
                  className="block h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${doc.progress}%` }}
                />
              </span>
              <span className="mt-1 block text-[10px] tabular-nums text-muted-foreground">
                {chapters > 0
                  ? `${chapters} ${pluralRu(chapters, "глава", "главы", "глав")} · `
                  : ""}
                {doc.progress}%
              </span>
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onToggleFavorite(doc.id)}
          aria-pressed={favorite}
          aria-label={favorite ? `Убрать «${doc.title}» из избранного` : `Добавить «${doc.title}» в избранное`}
          className={cn(
            "mt-2 mr-1 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            favorite ? "text-primary" : "text-muted-foreground/50 hover:text-foreground",
          )}
        >
          <Star
            className={cn("size-3.5", favorite && "fill-primary")}
            aria-hidden="true"
          />
        </button>
      </div>
    </li>
  );
}
