"use client";

/**
 * CaptureDialog — ⌘K / Ctrl+K quick thought capture. Fast single textarea
 * (no category pick — the analysis pipeline fills that in later): Enter
 * saves, Shift+Enter inserts a newline, Esc cancels. Success toast offers
 * a jump straight to the notebook.
 *
 * Voice (Stage 2): the mic button records via useVoiceRecorder, the
 * backend transcribes (POST /api/notes/voice) and the text lands in the
 * textarea for review — the user still saves with the regular flow.
 *
 * The form lives in an inner component: Radix unmounts dialog content on
 * close, so the draft state resets naturally without reset effects.
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, PenLine, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatRecordingTime,
  LEVEL_BAR_FACTORS,
  useVoiceRecorder,
  type VoiceClip,
} from "@/hooks/use-voice-recorder";
import { api, ApiError } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import { MAX_NOTE_LENGTH } from "@/lib/types";
import { ASR_GENERIC, MIC_START_FAILED, voiceResultCopy } from "@/lib/voice-copy";

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
        if (!next) {
          try {
            sessionStorage.removeItem("pocketstudio-quest");
          } catch {
            /* ignore */
          }
        }
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

  // Guards the manual-stop vs 90s-auto-stop race — only one upload runs.
  const finalizingRef = useRef(false);

  const finalizeRecording = async (clipArg?: VoiceClip) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    try {
      const clip = clipArg ?? (await recorder.stop());
      const note = await api.createVoiceNote({
        audioBase64: clip.audioBase64,
        mime: clip.mime,
      });
      const result = voiceResultCopy(note.rawText ?? note.transcription);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        // Text goes INTO the textarea — the user reviews and saves manually.
        setValue((prev) => {
          const base = prev.trim();
          const merged = base ? `${base}\n${result.text}` : result.text;
          return merged.slice(0, MAX_NOTE_LENGTH);
        });
        taRef.current?.focus();
        toast.success(result.toast);
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : ASR_GENERIC,
      );
    } finally {
      finalizingRef.current = false;
      recorder.reset();
    }
  };

  const recorder = useVoiceRecorder({
    onAutoStop: (clip) => void finalizeRecording(clip),
  });
  const { state: voiceState, elapsedMs, level, supported, error: voiceError } = recorder;
  const isRecording = voiceState === "recording";

  const startRecording = async () => {
    try {
      await recorder.start();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MIC_START_FAILED);
    }
  };

  // Auto-grow: 2 rows initially, capped at MAX_TEXTAREA_HEIGHT.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  const trimmed = value.trim();
  const canSubmit =
    !submitting && voiceState === "idle" && trimmed.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const note = await api.createNote({ text: trimmed });
      bumpNotes();
      setCaptureOpen(false);
      let quest = false;
      try {
        quest = sessionStorage.getItem("pocketstudio-quest") === "1";
        if (quest) sessionStorage.removeItem("pocketstudio-quest");
      } catch {
        quest = false;
      }
      if (quest) {
        useAppUi.getState().openNote(note, { auto: true });
        useAppUi.getState().setMainArea("chat");
        useAppUi.getState().setComposerDraft(
          `Quest: помоги разобраться с первой мыслью: «${trimmed.slice(0, 120)}»`,
        );
        toast.success("Quest начат — штурман ждёт вашу мысль в чате");
      } else {
        toast.success("Мысль сохранена ✓", {
          action: {
            label: "Открыть блокнот",
            onClick: () => useAppUi.getState().setMainArea("notebook"),
          },
        });
      }
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
        placeholder={isRecording ? "Слушаем вас…" : "Мысль, идея, наблюдение…"}
        maxLength={MAX_NOTE_LENGTH}
        disabled={submitting || isRecording}
        className="vf-scroll min-h-[3.4rem] w-full resize-none rounded-xl border bg-card px-3 py-2.5 text-sm leading-relaxed outline-none transition-all duration-150 placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {supported && isRecording && (
            <>
              <span
                className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-rose-500/10 px-3 text-rose-600 transition-colors duration-150 dark:text-rose-400"
                aria-hidden="true"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-rose-500" />
                </span>
                <span className="font-mono text-sm font-medium tabular-nums">
                  {formatRecordingTime(elapsedMs)}
                </span>
                <span className="flex h-4 items-end gap-[3px]">
                  {LEVEL_BAR_FACTORS.map((factor, i) => (
                    <span
                      key={i}
                      className="w-[3px] rounded-full bg-rose-500/80 transition-[height] duration-100 ease-out"
                      style={{
                        height: `${Math.max(3, Math.round(3 + level * 13 * factor))}px`,
                      }}
                    />
                  ))}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void finalizeRecording()}
                className="size-11 shrink-0 rounded-xl text-rose-600 transition-colors duration-150 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                aria-label="Остановить запись"
                aria-pressed={true}
              >
                <Square className="size-3.5 fill-current" aria-hidden="true" />
              </Button>
              <span className="sr-only" role="status">
                Идёт запись голоса
              </span>
            </>
          )}
          {supported && voiceState === "processing" && (
            <span
              className="flex h-11 shrink-0 items-center gap-2 px-1 text-sm text-muted-foreground"
              role="status"
            >
              <Loader2
                className="size-4 animate-spin text-rose-500"
                aria-hidden="true"
              />
              Распознаём…
              <span className="sr-only">Обрабатываем голосовую запись</span>
            </span>
          )}
          {supported && voiceState === "requesting" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled
              className="size-11 shrink-0 rounded-xl text-muted-foreground"
              aria-label="Запрос доступа к микрофону"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            </Button>
          )}
          {supported && voiceState === "idle" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void startRecording()}
              className="size-11 shrink-0 rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
              aria-label="Записать голос"
              aria-pressed={false}
              title="Записать голос"
            >
              <Mic className="size-4" aria-hidden="true" />
            </Button>
          )}
          {!isRecording && (
            <p
              className={`truncate text-[11px] leading-snug ${
                voiceError ? "text-destructive" : "text-muted-foreground"
              }`}
              role={voiceError ? "alert" : undefined}
            >
              {voiceError
                ? voiceError
                : "Enter — сохранить · Shift+Enter — перенос · Esc — отмена"}
            </p>
          )}
        </div>
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
