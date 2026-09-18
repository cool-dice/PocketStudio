"use client";

/**
 * WorkspaceChatTab — вкладка «Чат» воркспейса (PS-3-d).
 *
 * Демо-кокпит оркестратора воркспейса: осмысленная мок-беседа о
 * КОНКРЕТНОМ воркспейсе (тип, стадия, следующий шаг пайплайна),
 * композер с быстрыми подсказками и «печатающим» демо-ответом.
 * В Фазе A сюда подключится настоящий оркестратор со скоупом
 * тредов этого воркспейса (Thread.projectId).
 */

import { useEffect, useRef, useState } from "react";
import { MessageSquare, SendHorizontal, Sparkles } from "lucide-react";

import { StageBadge } from "@/components/studio/shared/module-header";
import {
  chatPromptsOf,
  chatSeedFor,
  mockReplyFor,
  type WorkspaceChatMessage,
} from "@/components/workspaces/workspace-chat-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  WORKSPACE_TYPE_META,
  type WorkspaceSummary,
} from "@/lib/workspace-data";

/** Задержка «печати» демо-ответа. */
const REPLY_DELAY_MS = 900;

function ChatBubble({ message }: { message: WorkspaceChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex w-full justify-end">
        <div className="flex max-w-[85%] flex-col items-end sm:max-w-[75%]">
          <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground">
            {message.text}
          </div>
          <span className="mt-1 px-1 text-[11px] text-muted-foreground">вы</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex w-full items-start gap-2.5 sm:gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="flex min-w-0 max-w-[85%] flex-col items-start sm:max-w-[75%]">
        <div className="w-full rounded-2xl rounded-bl-md border bg-card px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
          {message.text}
        </div>
        <span className="mt-1 px-1 text-[11px] text-muted-foreground">
          оркестратор
        </span>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex w-full items-start gap-2.5 sm:gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3">
        <span className="flex items-center gap-1.5" aria-label="Оркестратор печатает">
          <span className="vf-dot" />
          <span className="vf-dot" />
          <span className="vf-dot" />
        </span>
      </div>
    </div>
  );
}

export function WorkspaceChatTab({
  workspace,
}: {
  workspace: WorkspaceSummary;
}) {
  const typeMeta = WORKSPACE_TYPE_META[workspace.type];

  const [messages, setMessages] = useState<WorkspaceChatMessage[]>(() =>
    chatSeedFor(workspace),
  );
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Смена воркспейса → полный сброс через key={workspace.id} в роутере
     вкладок (remount), здесь остаётся только очистка при размонтировании:
     незавершённый демо-ответ не должен «долететь» в другую беседу. */
  useEffect(
    () => () => {
      if (replyTimerRef.current) {
        clearTimeout(replyTimerRef.current);
        replyTimerRef.current = null;
      }
    },
    [],
  );

  /* Новые реплики → мягкий автоскролл вниз. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  function send(text: string) {
    const value = text.trim();
    if (!value || typing) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: value },
    ]);
    setDraft("");
    setTyping(true);
    replyTimerRef.current = setTimeout(() => {
      replyTimerRef.current = null;
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: mockReplyFor(workspace),
        },
      ]);
    }, REPLY_DELAY_MS);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* ── Шапка кокпита ── */}
      <header className="shrink-0 border-b bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br text-white ${workspace.gradient}`}
          >
            <MessageSquare className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold">
                Оркестратор воркспейса «{workspace.title}»
              </h2>
              <StageBadge stage="wip" />
            </div>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {typeMeta.label} · стадия «{workspace.stage}» · демо-собеседник
              до Фазы A
            </p>
          </div>
        </div>
      </header>

      {/* ── Беседа ── */}
      <div
        ref={scrollRef}
        className="vf-scroll min-h-0 flex-1 overflow-y-auto"
        aria-live="polite"
        aria-label="Беседа с оркестратором воркспейса"
      >
        <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-4 sm:px-6">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          {typing ? <TypingBubble /> : null}
        </div>
      </div>

      {/* ── Композер ── */}
      <div className="shrink-0 border-t bg-background">
        <div className="mx-auto w-full max-w-3xl space-y-2 px-4 py-3 sm:px-6">
          <div className="vf-scroll-x flex gap-1.5 overflow-x-auto pb-0.5">
            {chatPromptsOf(workspace).map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => send(prompt)}
                disabled={typing}
                className="shrink-0 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Спросить оркестратора о воркспейсе…"
              aria-label="Сообщение оркестратору воркспейса"
              maxLength={500}
              className="h-10 bg-card"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || typing}
              className="h-10 w-10 shrink-0"
              aria-label="Отправить сообщение"
            >
              <SendHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
