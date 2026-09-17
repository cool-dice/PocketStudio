"use client";

/**
 * Composer — auto-growing textarea. Enter sends, Shift+Enter inserts a
 * newline. Disabled while the agent is thinking/streaming (busy).
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { MAX_MESSAGE_LENGTH } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { useThreads } from "@/hooks/use-threads";

const MAX_HEIGHT = 200;

export function Composer() {
  const { busy, sendMessage } = useThreads();
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea with content.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
  }, [value]);

  const canSend = !busy && value.trim().length > 0;

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
            placeholder={busy ? "VibeFlow печатает…" : "Напишите сообщение…"}
            disabled={busy}
            maxLength={MAX_MESSAGE_LENGTH}
            className="vf-scroll max-h-[200px] min-h-11 flex-1 resize-none self-center bg-transparent py-2.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Отправить сообщение"
            disabled={!canSend}
            className="size-10 shrink-0 rounded-xl"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
          {busy
            ? "Агент отвечает — подождите немного"
            : "Enter — отправить · Shift+Enter — новая строка"}
        </p>
      </form>
    </div>
  );
}
