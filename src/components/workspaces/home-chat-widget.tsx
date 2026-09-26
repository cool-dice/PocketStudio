"use client";

/**
 * HomeChatWidget — чат как виджет дашборда (PS-4).
 *
 * Компактная карточка живого чата оркестратора: последние сообщения
 * активного треда, поле ввода (Enter — отправить) и кнопка «Развернуть»,
 * открывающая полноценный чат. Работает на общем ThreadsProvider,
 * поэтому отправленное из виджета сразу видно в полном чате.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Loader2,
  Maximize2,
  Sparkles,
  Wrench,
} from "lucide-react";

import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreads } from "@/hooks/use-threads";
import {
  COMPOSER_TEXTAREA_MAX_CHARS,
  composerSizeUi,
} from "@/lib/message-send";
import { THREADS_LOAD_ERROR, THREADS_LOAD_ERROR_HINT } from "@/lib/thread-copy";
import { useAppUi } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

/** Сколько последних сообщений показывать в виджете. */
const TAIL = 12;

/** Стартовые подсказки для пустого треда — клик сразу отправляет. */
const STARTERS = [
  "Что ты умеешь?",
  "Набросай короткометражку",
  "Собери раскадровку",
];

export function HomeChatWidget() {
  const {
    activeThread,
    messages,
    messagesLoading,
    busy,
    thinking,
    sendMessage,
    ensureStudioThread,
    threadsLoading,
    threadsError,
    sendError,
    clearSendError,
  } = useThreads();
  const setMainArea = useAppUi((s) => s.setMainArea);

  const [value, setValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const studioScoped = activeThread?.projectId == null;
  const tail = studioScoped ? messages.slice(-TAIL) : [];

  useEffect(() => {
    if (threadsLoading || threadsError) return;
    void ensureStudioThread();
  }, [threadsLoading, threadsError, ensureStudioThread, activeThread?.projectId]);

  // Прижмаем список к низу при новых сообщениях/стриминге.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking, messagesLoading]);

  const size = composerSizeUi(value, sendError);
  const canSend =
    !busy &&
    !threadsError &&
    value.trim().length > 0 &&
    !size.disableSend;

  const submit = async () => {
    if (!canSend || size.disableSend) return;
    if (threadsError) return;
    const text = value.trim();
    setValue("");
    await ensureStudioThread();
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const expand = () => setMainArea("chat");

  return (
    <section
      aria-label="Чат со студией"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
    >
      {/* ── Шапка виджета ── */}
      <header className="flex shrink-0 items-center gap-2.5 border-b bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
        <LogoMark className="size-7 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold leading-tight">
            Чат со студией
          </h2>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">
            {activeThread?.projectId == null
              ? (activeThread?.title ?? "Новый диалог")
              : "Диалог студии"}
          </p>
        </div>
        {busy && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            печатает
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={expand}
          className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
          title="Открыть полный чат"
        >
          <Maximize2 className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Развернуть</span>
        </Button>
      </header>

      {/* ── Лента сообщений ── */}
      <div
        ref={listRef}
        className="vf-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
      >
        {threadsError ? (
          <div className="flex flex-col items-start gap-1 py-4">
            <p className="text-sm font-medium">{THREADS_LOAD_ERROR}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {THREADS_LOAD_ERROR_HINT}
            </p>
          </div>
        ) : messagesLoading || !studioScoped ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="ml-auto h-8 w-1/2" />
            <Skeleton className="h-12 w-3/4" />
          </div>
        ) : tail.length === 0 ? (
          <EmptyThread
            onStarter={(text) => {
              void ensureStudioThread().then(() => sendMessage(text));
            }}
            onExpand={expand}
          />
        ) : (
          tail.map((m) => <WidgetBubble key={m.id} message={m} />)
        )}
        {thinking && <WidgetThinking />}
      </div>

      {/* ── Композер виджета ── */}
      <footer className="shrink-0 border-t bg-background p-3">
        <div className="flex items-end gap-2 rounded-xl border bg-card p-1.5 pl-3 transition-shadow duration-200 focus-within:ring-2 focus-within:ring-ring/60">
          <label htmlFor="home-chat-widget-input" className="sr-only">
            Сообщение студии
          </label>
          <textarea
            id="home-chat-widget-input"
            ref={taRef}
            rows={1}
            value={value}
            onChange={(e) => {
              if (sendError) clearSendError();
              setValue(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            disabled={busy || Boolean(threadsError)}
            maxLength={COMPOSER_TEXTAREA_MAX_CHARS}
            aria-invalid={Boolean(size.error)}
            aria-describedby={
              size.showCount
                ? "home-chat-widget-hint home-chat-widget-count"
                : "home-chat-widget-hint"
            }
            placeholder={busy ? "Студия печатает…" : "Спросите студию…"}
            className="vf-scroll max-h-24 min-h-9 flex-1 resize-none self-center bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
          />
          <Button
            type="button"
            size="icon"
            aria-label="Отправить сообщение"
            disabled={!canSend}
            onClick={() => void submit()}
            className="size-9 shrink-0 self-center rounded-lg"
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-2 px-1">
          <p
            id="home-chat-widget-hint"
            className={`min-w-0 flex-1 text-[10px] ${
              size.error ? "text-destructive" : "text-muted-foreground"
            }`}
            role={size.error ? "alert" : undefined}
          >
            {size.error
              ? size.error
              : "Enter — отправить · Shift+Enter — новая строка"}
          </p>
          {size.showCount ? (
            <span
              id="home-chat-widget-count"
              className={`shrink-0 text-[10px] tabular-nums ${
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
      </footer>
    </section>
  );
}

/* ── Пустой тред: стартовые подсказки ── */

function EmptyThread({
  onStarter,
  onExpand,
}: {
  onStarter: (text: string) => void;
  onExpand: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 py-6 text-center">
      <span
        className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Sparkles className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">Начните с мысли</p>
        <p className="mx-auto max-w-64 text-balance text-xs leading-relaxed text-muted-foreground">
          Киностудия слушает: от замысла до фильма — сценарий, кадры, звук и монтаж
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {STARTERS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onStarter(text)}
            className="rounded-full border bg-background px-3 py-1.5 text-xs outline-none transition-colors duration-150 hover:border-primary/40 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {text}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onExpand}
        className="text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        Открыть полный чат
      </button>
    </div>
  );
}

/* ── Компактный пузырь: user / assistant / tool ── */

function WidgetBubble({ message }: { message: ChatMessage }) {
  if (message.role === "tool") {
    return (
      <p className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <Wrench className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {message.toolName ? `Инструмент: ${message.toolName}` : "Инструмент"}
        </span>
      </p>
    );
  }

  const isUser = message.role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border bg-background text-foreground",
          message.pending && "opacity-70",
        )}
        title={message.pending ? "Отправляется…" : undefined}
      >
        <p className="whitespace-pre-wrap break-words line-clamp-6">
          {message.content}
        </p>
        {message.streaming && (
          <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary/70" />
        )}
      </div>
    </div>
  );
}

function WidgetThinking() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span
        className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary"
        aria-hidden="true"
      >
        <Sparkles className="size-3" />
      </span>
      <span className="flex items-center gap-1">
        <span className="vf-dot" />
        <span className="vf-dot" />
        <span className="vf-dot" />
      </span>
      <span className="sr-only">Студия печатает</span>
    </div>
  );
}
