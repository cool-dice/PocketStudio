"use client";

/**
 * MobileNoteDialog — note detail for viewports below xl (where the context
 * panel is hidden). Opened explicitly from notebook card taps; agent
 * auto-opens (tool results) never pop it to avoid interrupting the chat.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NoteDetail } from "@/components/app/note-detail";
import { useIsNarrow } from "@/hooks/use-media-query";
import { useAppUi } from "@/lib/store";

export function MobileNoteDialog() {
  const isNarrow = useIsNarrow();
  const note = useAppUi((s) => s.contextNote);
  const dialogOpen = useAppUi((s) => s.noteDialogOpen);
  const closeNoteDialog = useAppUi((s) => s.closeNoteDialog);

  if (!isNarrow) return null;

  return (
    <Dialog
      open={dialogOpen && note !== null}
      onOpenChange={(open) => {
        if (!open) closeNoteDialog();
      }}
    >
      <DialogContent
        className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-left text-sm">Заметка</DialogTitle>
          <DialogDescription className="sr-only">
            Полный текст заметки и действия с ней
          </DialogDescription>
        </DialogHeader>
        {note && <NoteDetail note={note} onDismiss={closeNoteDialog} />}
      </DialogContent>
    </Dialog>
  );
}
