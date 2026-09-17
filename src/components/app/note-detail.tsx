"use client";

/**
 * NoteDetail — full note view for the context panel (xl+) and the mobile
 * note dialog: full text, category chip, meta, favorite / «Обсудить в чате» /
 * delete actions. Used by ContextPanel and MobileNoteDialog.
 */

import { useState } from "react";
import { MessageCircle, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useThreads } from "@/hooks/use-threads";
import { formatNoteDate, textPreview } from "@/lib/format";
import { useAppUi } from "@/lib/store";
import {
  CategoryGlyph,
  categoryColorStyle,
} from "@/lib/category-style";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NoteDetailProps {
  note: Note;
  /** Dismiss the wrapper (mobile dialog) after discuss/delete. */
  onDismiss?: () => void;
}

export function NoteDetail({ note, onDismiss }: NoteDetailProps) {
  const { sendMessage, busy } = useThreads();
  const setMainArea = useAppUi((s) => s.setMainArea);
  const closeNote = useAppUi((s) => s.closeNote);
  const updateContextNote = useAppUi((s) => s.updateContextNote);
  const bumpNotes = useAppUi((s) => s.bumpNotes);

  const [favBusy, setFavBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const chipStyle = note.category
    ? categoryColorStyle(note.category.color)
    : null;

  const toggleFavorite = async () => {
    if (favBusy) return;
    setFavBusy(true);
    updateContextNote({ ...note, favorite: !note.favorite });
    try {
      const updated = await api.updateNote(note.id, {
        favorite: !note.favorite,
      });
      updateContextNote(updated);
      bumpNotes();
    } catch {
      updateContextNote(note);
      toast.error("Не удалось обновить заметку");
    } finally {
      setFavBusy(false);
    }
  };

  const discuss = async () => {
    const quote = textPreview(note.rawText ?? "", 120);
    onDismiss?.();
    setMainArea("chat");
    await sendMessage(`Помоги мне разобраться с этой заметкой: «${quote}»`);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteNote(note.id);
      bumpNotes();
      closeNote();
      onDismiss?.();
      toast.success("Заметка удалена");
    } catch {
      toast.error("Не удалось удалить заметку");
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Body ── */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {note.category && chipStyle && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                chipStyle.chip,
              )}
            >
              <CategoryGlyph icon={note.category.icon} className="size-3" />
              {note.category.name}
            </span>
          )}
          {note.status === "pending" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              <span
                aria-hidden="true"
                className="vf-status-pulse size-1.5 rounded-full bg-amber-500"
              />
              Анализ скоро
            </span>
          )}
        </div>

        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
          {note.rawText || ""}
        </p>
      </div>

      {/* ── Meta + actions ── */}
      <div className="shrink-0 border-t p-3">
        <p className="px-1 pb-2 text-[11px] text-muted-foreground">
          Создана {formatNoteDate(note.createdAt)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-w-0 flex-1 gap-1.5 rounded-xl"
            onClick={() => void toggleFavorite()}
            disabled={favBusy}
            aria-pressed={note.favorite}
          >
            <Star
              className={cn(
                "size-3.5 transition-colors duration-150",
                note.favorite && "fill-amber-400 text-amber-500",
              )}
              aria-hidden="true"
            />
            <span className="truncate">
              {note.favorite ? "В избранном" : "В избранное"}
            </span>
          </Button>
          <Button
            size="sm"
            className="h-9 min-w-0 flex-1 gap-1.5 rounded-xl"
            onClick={() => void discuss()}
            disabled={busy}
            aria-label="Обсудить заметку в чате"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Обсудить
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-xl hover:border-destructive/40 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            aria-label="Удалить заметку"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заметку?</AlertDialogTitle>
            <AlertDialogDescription>
              Заметка будет удалена безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
