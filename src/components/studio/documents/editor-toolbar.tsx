"use client";

/**
 * Клейкая панель форматирования над «страницей» редактора:
 * кнопки-иконки с тултипами (title), undo/redo и индикатор автосохранения.
 */

import {
  Bold,
  Check,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  Quote,
  Redo2,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

const FORMAT_ACTIONS: { icon: LucideIcon; label: string }[] = [
  { icon: Bold, label: "Полужирный (Ctrl+B)" },
  { icon: Italic, label: "Курсив (Ctrl+I)" },
  { icon: Heading2, label: "Подзаголовок H2" },
  { icon: List, label: "Маркированный список" },
  { icon: Quote, label: "Цитата" },
  { icon: Link2, label: "Ссылка (Ctrl+K)" },
  { icon: ImageIcon, label: "Изображение" },
];

const HISTORY_ACTIONS: { icon: LucideIcon; label: string }[] = [
  { icon: Undo2, label: "Отменить (Ctrl+Z)" },
  { icon: Redo2, label: "Повторить (Ctrl+Shift+Z)" },
];

export function EditorToolbar({ savedLabel = "Сохранено · 2 мин назад" }: { savedLabel?: string }) {
  return (
    <div className="sticky top-0 z-10 border-y bg-muted/40 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
      <div className="mx-auto flex max-w-3xl items-center gap-0.5 px-3 py-1.5 sm:px-6">
        {FORMAT_ACTIONS.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="ghost"
            size="icon"
            title={action.label}
            aria-label={action.label}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <action.icon className="size-4" aria-hidden="true" />
          </Button>
        ))}

        <span className="mx-1.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />

        {HISTORY_ACTIONS.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="ghost"
            size="icon"
            title={action.label}
            aria-label={action.label}
            className="size-8 text-muted-foreground hover:text-foreground"
          >
            <action.icon className="size-4" aria-hidden="true" />
          </Button>
        ))}

        <span
          className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
          title="Автосохранение включено"
        >
          <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="hidden min-[420px]:inline">{savedLabel}</span>
          <span className="min-[420px]:hidden">Сохранено</span>
        </span>
      </div>
    </div>
  );
}
