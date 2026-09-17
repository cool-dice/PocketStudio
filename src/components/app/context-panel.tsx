"use client";

/**
 * ContextPanel — right zone placeholder (notes, files, plans will live here
 * in later stages). Collapsible; hidden below xl breakpoints.
 */

import { Layers, PanelRightClose } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ContextPanel({ onClose }: { onClose: () => void }) {
  return (
    <aside
      aria-label="Панель контекста"
      className="hidden w-80 shrink-0 flex-col border-l bg-card/40 xl:flex"
    >
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">Контекст</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Скрыть панель контекста"
          className="size-8"
        >
          <PanelRightClose className="size-4" aria-hidden="true" />
        </Button>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Layers className="size-5 text-muted-foreground" aria-hidden="true" />
        </span>
        <p className="max-w-[220px] text-sm leading-relaxed text-muted-foreground">
          Контекст появится здесь — заметки, файлы, планы
        </p>
      </div>
    </aside>
  );
}
