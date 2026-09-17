"use client";

/**
 * Composer — auto-growing textarea. Enter sends, Shift+Enter inserts a
 * newline. Disabled while the agent is thinking/streaming (busy).
 *
 * Voice (Stage 2): compact mic next to the send button — records via
 * useVoiceRecorder, the backend transcribes (POST /api/notes/voice) and
 * the text is appended to the message input for review before sending.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";

import { MAX_MESSAGE_LENGTH } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  formatRecordingTime,
  useVoiceRecorder,
  type VoiceClip,
} from "@/hooks/use-voice-recorder";
import { useThreads } from "@/hooks/use-threads";
import { api, ApiError } from "@/lib/api";

const MAX_HEIGHT = 200;

export function Composer() {
  const { busy, sendMessage } = useThreads();
  const [value, setValue] = useState("");
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
      const text = (note.rawText ?? note.transcription ?? "").trim();
      if (!text) {
        toast.error("Не удалось распознать речь — попробуйте записать ещё раз");
      } else {
        // Append to whatever is already typed — the user reviews and sends.
        setValue((prev) => {
          const base = prev.trim();
          const merged = base ? `${base} ${text}` : text;
          return merged.slice(0, MAX_MESSAGE_LENGTH);
        });
        taRef.current?.focus();
        toast.success("Голос распознан — проверьте текст");
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Не удалось распознать голос",
      );
    } finally {
      finalizingRef.current = false;
      recorder.reset();
    }
  };

  const recorder = useVoiceRecorder({
    onAutoStop: (clip) => void finalizeRecording(clip),
  });
  const { state: voiceState, elapsedMs, supported } = recorder;
  const isRecording = voiceState === "recording";

  const startRecording = async () => {
    try {
      await recorder.start();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось начать запись");
    }
  };

  // Auto-grow the textarea with content.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const canSend = !busy && !isRecording && value.trim().length > 0;

  const submit = async () => {
    if (!canSend) return;
    const text = value;
    setValue("");
    await sendMessage(text);
    taRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t bg-background">
      <form
        className="mx-auto w-full max-w-3xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border bg-card p-1.5 pl-3 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-ring/60">
          <label htmlFor="composer" className="sr-only">
            Сообщение
          </label>
          <textarea
            id="composer"
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording
                ? "Слушаем вас…"
                : busy
                  ? "VibeFlow печатает…"
                  : "Напишите сообщение…"
            }
            disabled={busy || isRecording}
            maxLength={MAX_MESSAGE_LENGTH}
            className="vf-scroll max-h-[200px] min-h-11 flex-1 resize-none self-center bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />

          {supported && voiceState === "idle" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void startRecording()}
              disabled={busy}
              className="size-11 shrink-0 self-center rounded-xl text-muted-foreground transition-colors duration-150 hover:text-foreground"
              aria-label="Записать голос"
              aria-pressed={false}
              title="Записать голос"
            >
              <Mic className="size-4" aria-hidden="true" />
            </Button>
          )}

          {isRecording && (
            <div
              className="flex shrink-0 self-center items-center gap-0.5 rounded-xl bg-rose-500/10 pl-2.5"
              role="status"
            >
              <span
                className="relative flex size-1.5"
                aria-hidden="true"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-rose-500" />
              </span>
              <span
                className="px-1.5 font-mono text-xs font-medium tabular-nums text-rose-600 dark:text-rose-400"
                aria-hidden="true"
              >
                {formatRecordingTime(elapsedMs)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void finalizeRecording()}
                className="size-11 rounded-xl text-rose-600 transition-colors duration-150 hover:bg-rose-500/15 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
                aria-label="Остановить запись"
                aria-pressed={true}
              >
                <Square className="size-3.5 fill-current" aria-hidden="true" />
              </Button>
              <span className="sr-only">Идёт запись голоса</span>
            </div>
          )}

          {(voiceState === "requesting" || voiceState === "processing") && (
            <span
              className="flex size-11 shrink-0 items-center justify-center self-center"
              role="status"
              aria-label={
                voiceState === "processing"
                  ? "Распознаём голос"
                  : "Включаем микрофон"
              }
            >
              <Loader2
                className="size-4 animate-spin text-rose-500"
                aria-hidden="true"
              />
            </span>
          )}

          <Button
            type="submit"
            size="icon"
            aria-label="Отправить сообщение"
            disabled={!canSend}
            className="size-11 shrink-0 rounded-xl"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
          {isRecording
            ? "Идёт запись голоса"
            : voiceState === "processing"
              ? "Распознаём голос…"
              : busy
                ? "Агент отвечает — подождите немного"
                : "Enter — отправить · Shift+Enter — новая строка"}
        </p>
      </form>
    </div>
  );
}
