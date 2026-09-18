"use client";

/**
 * ContextPanel — right zone (xl+): placeholder content, or the full note
 * detail when a note is open (notebook card click / agent tool result).
 * The X next to the title closes the note (back to placeholder); the panel
 * button collapses the panel entirely.
 */

import { Layers, PanelRightClose, X } from "lucide-react";

import { NoteDetail } from "@/components/app/note-detail";
import { Button } from "@/components/ui/button";
import { useAppUi } from "@/lib/store";

export function ContextPanel({ onClose }: { onClose: () => void }) {
  const contextNote = useAppUi((s) => s.contextNote);
  const closeNote = useAppUi((s) => s.closeNote);

  return (
    <aside
      aria-label="Панель контекста"
      className="hidden w-80 shrink-0 flex-col border-l bg-card/40 xl:flex"
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-1 border-b px-4">
        <h2 className="text-sm font-semibold">
          {contextNote ? "Заметка" : "Контекст"}
        </h2>
        <div className="flex items-center gap-1">
          {contextNote && (
            <Button
              variant="ghost"
              size="icon"
              onClick={closeNote}
              aria-label="Закрыть заметку"
              className="size-8"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Скрыть панель контекста"
            className="size-8"
          >
            <PanelRightClose className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {contextNote ? (
        <NoteDetail note={contextNote} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Layers className="size-5 text-muted-foreground" aria-hidden="true" />
          </span>
          <p className="max-w-[220px] text-sm leading-relaxed text-muted-foreground">
            Контекст появится здесь — заметки, файлы, планы
          </p>
        </div>
      )}
    </aside>
  );
}
