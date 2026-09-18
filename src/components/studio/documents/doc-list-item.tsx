"use client";

/**
 * Элемент библиотеки документов: тип, название, живые слова и секции
 * из DocumentDto, «N мин назад» по ISO-дате. В глобальном режиме
 * используется ShelfHeader — заголовок «полки» воркспейса. Меню (…)
 * удаляет документ (с подтверждением в диалоге библиотеки).
 */

import { Library, MoreHorizontal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { DocumentDto } from "@/lib/workspace-types";
import { WORKSPACE_TYPE_META } from "@/lib/workspace-data";
import { agoFromISO, docKindMeta, formatNumber, pluralRu } from "./types";

/** Заголовок «полки» — воркспейса в глобальном режиме. */
export function ShelfHeader({
  type,
  label,
  count,
}: {
  type: string;
  label: string;
  count: number;
}) {
  const meta = WORKSPACE_TYPE_META[type as keyof typeof WORKSPACE_TYPE_META];
  const Icon = meta?.icon ?? Library;
  return (
    <li
      className="flex items-center gap-1.5 px-2 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
    >
      <Icon className="size-3 shrink-0 text-primary/70" aria-hidden="true" />
      <span className="truncate">{label}</span>
      <span className="ml-auto shrink-0 tabular-nums text-muted-foreground/70">{count}</span>
    </li>
  );
}

export function DocListItem({
  doc,
  active,
  onSelect,
  onRemove,
}: {
  doc: DocumentDto;
  active: boolean;
  onSelect: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const kind = docKindMeta(doc.kind);
  const Icon = kind.icon;
  const sections = doc.sections?.length ?? doc.sectionsCount ?? 0;

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
                  {formatNumber(doc.wordsCount)}{" "}
                  {pluralRu(doc.wordsCount, "слово", "слова", "слов")}
                </span>
                <span className="inline-flex items-center rounded-full border border-border bg-background px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                  {kind.label}
                </span>
              </span>
              <span className="mt-1.5 block text-[10px] tabular-nums text-muted-foreground">
                {sections > 0
                  ? `${formatNumber(sections)} ${pluralRu(sections, "секция", "секции", "секций")} · `
                  : ""}
                {agoFromISO(doc.updatedAt)}
              </span>
            </span>
          </span>
        </button>
        {onRemove ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Действия с документом «${doc.title}»`}
                className="mt-1.5 mr-0.5 size-7 shrink-0 text-muted-foreground/60 hover:text-foreground"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={() => onRemove(doc.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Удалить документ
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </li>
  );
}
