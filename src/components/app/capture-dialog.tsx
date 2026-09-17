"use client";

/**
 * CaptureDialog — ⌘K / Ctrl+K quick thought capture. Fast single textarea
 * (no category pick — the analysis pipeline fills that in later): Enter
 * saves, Shift+Enter inserts a newline, Esc cancels. Success toast offers
 * a jump straight to the notebook.
 *
 * The form lives in an inner component: Radix unmounts dialog content on
 * close, so the draft state resets naturally without reset effects.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, ApiError } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import { MAX_NOTE_LENGTH } from "@/lib/types";

/** ~12 rows of text-sm/leading-relaxed before the inner scrollbar kicks in. */
const MAX_TEXTAREA_HEIGHT = 288;

export function CaptureDialog() {
  const open = useAppUi((s) => s.captureOpen);
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Allow closing mid-save too: the request completes in the background
        // and its toast still fires.
        setCaptureOpen(next);
      }}
    >
      <DialogContent
        className="top-[30%] gap-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <PenLine className="size-4 text-primary" aria-hidden="true" />
            Записать мысль
          </DialogTitle>
          <DialogDescription className="sr-only">
            Быстрая запись мысли в блокнот
          </DialogDescription>
        </DialogHeader>
        {open && <CaptureForm />}
      </DialogContent>
    </Dialog>
  );
}

function CaptureForm() {
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const bumpNotes = useAppUi((s) => s.bumpNotes);

  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow: 2 rows initially, capped at MAX_TEXTAREA_HEIGHT.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  const trimmed = value.trim();
  const canSubmit = !submitting && trimmed.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.createNote({ text: trimmed });
      bumpNotes();
      setCaptureOpen(false);
      toast.success("Мысль сохранена ✓", {
        action: {
          label: "Открыть блокнот",
          onClick: () => useAppUi.getState().setMainArea("notebook"),
        },
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось сохранить мысль",
      );
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-3"
    >
      <label htmlFor="capture-text" className="sr-only">
        Текст мысли
      </label>
      <textarea
        id="capture-text"
        ref={taRef}
        rows={2}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Мысль, идея, наблюдение…"
        maxLength={MAX_NOTE_LENGTH}
        disabled={submitting}
        className="vf-scroll min-h-[3.4rem] w-full resize-none rounded-xl border bg-card px-3 py-2.5 text-sm leading-relaxed outline-none transition-shadow duration-150 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Enter — сохранить · Shift+Enter — перенос · Esc — отмена
        </p>
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            value.length > MAX_NOTE_LENGTH * 0.9
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          }`}
          aria-live="polite"
        >
          {value.length} / {MAX_NOTE_LENGTH}
        </span>
      </div>
      <Button
        type="submit"
        className="h-10 w-full gap-2 rounded-xl"
        disabled={!canSubmit}
        aria-label="Сохранить мысль"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Сохраняем…
          </>
        ) : (
          <>
            <PenLine className="size-4" aria-hidden="true" />
            Сохранить
          </>
        )}
      </Button>
    </form>
  );
}
