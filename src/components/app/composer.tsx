"use client";

/**
 * Composer — auto-growing textarea. Enter sends, Shift+Enter inserts a
 * newline. Disabled while the agent is thinking/streaming (busy).
 * Slash commands: typing "/" opens a command menu above the input —
 * mode switches, quick note prefix, notebook, global search.
 *
 * Voice (Stage 2): compact mic next to the send button — records via
 * useVoiceRecorder, the backend transcribes (POST /api/notes/voice → { text })
 * and the text is appended to the message input for review before sending.
 * Chat voice does not create a notebook note.
 *
 * Oversize: UTF-8 > 64 KiB shows the same Russian `error` copy as the
 * socket event, disables send, and a byte count appears near the cap.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";

import {
  SlashCommandsMenu,
  filterSlashCommands,
  isSlashTokenActive,
  slashToken,
  SLASH_MODE_ICONS,
  SLASH_MISC_ICONS,
  type SlashCommand,
} from "@/components/app/slash-commands";
import {
  MAX_MESSAGE_LENGTH,
  MODE_LABELS,
  type ThreadMode,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  formatRecordingTime,
  useVoiceRecorder,
  type VoiceClip,
} from "@/hooks/use-voice-recorder";
import { useThreads } from "@/hooks/use-threads";
import { api, ApiError } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import { ASR_GENERIC, MIC_START_FAILED, voiceResultCopy } from "@/lib/voice-copy";
import {
  COMPOSER_TEXTAREA_MAX_CHARS,
  composerSizeUi,
} from "@/lib/message-send";

const MAX_HEIGHT = 200;

export function Composer({
  locked = false,
  scopeProjectId,
}: {
  locked?: boolean;
  /** When set, chip/send stay on this workspace — never the previous one. */
  scopeProjectId?: string | null;
}) {
  const { busy, sendMessage, abortTurn, activeThread, updateThreadMode, sendError, clearSendError } =
    useThreads();
  const setMainArea = useAppUi((s) => s.setMainArea);
  const setSearchOpen = useAppUi((s) => s.setSearchOpen);
  const composerDraft = useAppUi((s) => s.composerDraft);
  const composerAutoSendProjectId = useAppUi((s) => s.composerAutoSendProjectId);
  const setComposerDraft = useAppUi((s) => s.setComposerDraft);
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const pendingAutoSend = useRef<{
    text: string;
    projectId: string | null;
  } | null>(null);

  useEffect(() => {
    if (!composerDraft) return;
    const text = composerDraft;
    const autoProjectId = composerAutoSendProjectId;
    setValue(text);
    setComposerDraft(null);
    if (autoProjectId !== undefined) {
      pendingAutoSend.current = { text, projectId: autoProjectId };
    }
    requestAnimationFrame(() => taRef.current?.focus());
  }, [composerDraft, composerAutoSendProjectId, setComposerDraft]);

  useEffect(() => {
    const pending = pendingAutoSend.current;
    if (!pending || busy || locked || !activeThread) return;
    const have = activeThread.projectId ?? null;
    if (pending.projectId !== have) return;
    const size = composerSizeUi(pending.text);
    if (size.disableSend) {
      pendingAutoSend.current = null;
      return;
    }
    pendingAutoSend.current = null;
    setValue("");
    void sendMessage(pending.text);
  }, [activeThread, busy, locked, sendMessage]);

  const threadProjectId = activeThread?.projectId ?? null;
  const scoped =
    scopeProjectId === undefined || threadProjectId === scopeProjectId;

  // Guards the manual-stop vs 90s-auto-stop race — only one upload runs.
  const finalizingRef = useRef(false);

  /* ── Slash commands (Stage 4) ── */

  const slashOpen = isSlashTokenActive(value);
  const token = slashOpen ? slashToken(value) : "";

  const commands = useMemo<SlashCommand[]>(() => {
    const list: SlashCommand[] = [
      {
        name: "заметка",
        label: "Заметка",
        description: "Быстро записать мысль в блокнот",
        icon: SLASH_MISC_ICONS.note,
        run: () => {
          setValue("Сохрани заметку: ");
          requestAnimationFrame(() => taRef.current?.focus());
        },
      },
      {
        name: "блокнот",
        label: "Блокнот",
        description: "Открыть все заметки",
        icon: SLASH_MISC_ICONS.notebook,
        run: () => setMainArea("notebook"),
      },
      {
        name: "поиск",
        label: "Поиск",
        description: "Искать по диалогам, заметкам и воркспейсам",
        icon: SLASH_MISC_ICONS.search,
        run: () => setSearchOpen(true),
      },
    ];

    if (activeThread) {
      const SLASH_MODE_NAMES: Record<ThreadMode, string> = {
        ask: "спросить",
        plan: "план",
        act: "действовать",
        review: "ревью",
      };
      for (const mode of ["ask", "plan", "act", "review"] as const) {
        const Icon = SLASH_MODE_ICONS[mode];
        list.push({
          name: SLASH_MODE_NAMES[mode],
          label: `Режим «${MODE_LABELS[mode]}»`,
          description: `Переключить диалог в режим «${MODE_LABELS[mode]}»`,
          icon: Icon,
          run: async () => {
            try {
              await updateThreadMode(activeThread.id, mode);
              toast.success(`Режим: ${MODE_LABELS[mode]}`);
            } catch {
              toast.error("Не удалось сменить режим");
            }
          },
        });
      }
    }

    return list;
  }, [
    activeThread,
    setMainArea,
    setSearchOpen,
    updateThreadMode,
  ]);

  const filteredCommands = useMemo(
    () => (slashOpen ? filterSlashCommands(commands, token) : []),
    [slashOpen, commands, token],
  );

  const [slashIndex, setSlashIndex] = useState(0);
  useEffect(() => {
    setSlashIndex(0);
  }, [token]);
  const submittingRef = useRef(false);

  const executeCommand = (cmd: SlashCommand) => {
    setValue("");
    void cmd.run();
  };

  const finalizeRecording = async (clipArg?: VoiceClip) => {
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    try {
      const clip = clipArg ?? (await recorder.stop());
      const text = await api.transcribeVoice({
        audioBase64: clip.audioBase64,
        mime: clip.mime,
      });
      const result = voiceResultCopy(text);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        // Append to whatever is already typed — the user reviews and sends.
        setValue((prev) => {
          const base = prev.trim();
          const merged = base ? `${base} ${result.text}` : result.text;
          return merged.slice(0, MAX_MESSAGE_LENGTH);
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
  const { state: voiceState, elapsedMs, supported } = recorder;
  const isRecording = voiceState === "recording";

  const startRecording = async () => {
    try {
      await recorder.start();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : MIC_START_FAILED);
    }
  };

  // Auto-grow the textarea with content.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const blocked = busy || locked || !scoped;
  const size = composerSizeUi(value, sendError);
  const canSend =
    !blocked &&
    !isRecording &&
    value.trim().length > 0 &&
    !size.disableSend;

  const submit = async () => {
    if (!canSend || submittingRef.current || size.disableSend) return;
    submittingRef.current = true;
    const text = value;
    setValue("");
    try {
      await sendMessage(text);
    } finally {
      submittingRef.current = false;
    }
    taRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash menu keyboard navigation takes priority while open.
    if (slashOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashIndex((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashIndex(
          (i) => (i - 1 + filteredCommands.length) % filteredCommands.length,
        );
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const cmd = filteredCommands[slashIndex];
        if (cmd) setValue(`/${cmd.name} `);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const cmd = filteredCommands[slashIndex];
        if (cmd) executeCommand(cmd);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t bg-background">
      <form
        className="relative mx-auto w-full min-w-0 max-w-3xl px-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <SlashCommandsMenu
          open={slashOpen && filteredCommands.length > 0 && !blocked && !isRecording}
          commands={filteredCommands}
          selectedIndex={slashIndex}
          onSelectIndex={setSlashIndex}
          onExecute={executeCommand}
        />

        <div className="flex min-w-0 items-end gap-2 rounded-2xl border bg-card p-1.5 pl-3 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-ring/60">
          <label htmlFor="composer" className="sr-only">
            Сообщение
          </label>
          <textarea
            id="composer"
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => {
              if (sendError) clearSendError();
              setValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            aria-invalid={Boolean(size.error)}
            aria-describedby={
              size.showCount ? "composer-hint composer-count" : "composer-hint"
            }
            placeholder={
              isRecording
                ? "Слушаем вас…"
                : locked && !busy
                  ? "Подключаем чат воркспейса…"
                  : blocked
                    ? "Студия печатает…"
                    : "Напишите сообщение… или / для команд"
            }
            disabled={blocked || isRecording}
            maxLength={COMPOSER_TEXTAREA_MAX_CHARS}
            className="vf-scroll max-h-[200px] min-h-11 min-w-0 flex-1 resize-none self-center bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />

          {supported && voiceState === "idle" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void startRecording()}
              disabled={blocked}
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

          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              aria-label="Остановить генерацию"
              onClick={() => abortTurn()}
              className="size-11 shrink-0 rounded-xl"
            >
              <Square className="size-3.5 fill-current" aria-hidden="true" />
            </Button>
          ) : (
          <Button
            type="submit"
            size="icon"
            aria-label="Отправить сообщение"
            disabled={!canSend}
            className="size-11 shrink-0 rounded-xl"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
          )}
        </div>
        <div className="mt-2 flex items-start justify-between gap-2 px-1">
          <p
            id="composer-hint"
            className={`min-w-0 flex-1 text-xs ${
              size.error ? "text-destructive" : "text-muted-foreground"
            }`}
            role={size.error ? "alert" : undefined}
          >
            {size.error
              ? size.error
              : isRecording
                ? "Идёт запись голоса"
                : voiceState === "processing"
                  ? "Распознаём голос…"
                  : locked && !busy
                    ? "Подключаем чат воркспейса…"
                    : busy
                      ? "Стоп — прервать ответ агента"
                      : blocked
                        ? "Агент отвечает — подождите немного"
                        : "Enter — отправить · Shift+Enter — новая строка · / — команды"}
          </p>
          {size.showCount ? (
            <span
              id="composer-count"
              className={`shrink-0 text-[11px] tabular-nums ${
                size.oversized
                  ? "text-destructive"
                  : "text-amber-600 dark:text-amber-400"
              }`}
              aria-live="polite"
            >
              {size.countLabel}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
