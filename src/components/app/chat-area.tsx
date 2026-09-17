"use client";

/**
 * ChatArea — center zone: header (mobile nav, thread title, mode badge,
 * context toggle), scrollable messages with smart auto-scroll and a
 * «к новым» pill, welcome screen for empty threads, composer.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowDown, Menu, PanelRight, PanelRightOpen, Sparkles } from "lucide-react";

import { Composer } from "@/components/app/composer";
import { MessageBubble } from "@/components/app/message-bubble";
import { Welcome } from "@/components/app/welcome";
import { LogoMark } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreads } from "@/hooks/use-threads";
import { MODE_LABELS } from "@/lib/types";

const SCROLL_THRESHOLD = 150;

interface ChatAreaProps {
  contextOpen: boolean;
  onToggleContext: () => void;
  onOpenMobileNav: () => void;
}

export function ChatArea({
  contextOpen,
  onToggleContext,
  onOpenMobileNav,
}: ChatAreaProps) {
  const {
    activeThread,
    activeThreadId,
    messages,
    messagesLoading,
    busy,
    thinking,
  } = useThreads();

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  // Auto-scroll on new messages / streamed deltas unless the user scrolled up.
  useEffect(() => {
    if (!stickToBottomRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, thinking]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < SCROLL_THRESHOLD;
    setShowJump(distance >= SCROLL_THRESHOLD);
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = true;
    setShowJump(false);
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const showWelcome = !messagesLoading && messages.length === 0;

  return (
    <section
      aria-label="Диалог"
      className="relative flex min-w-0 flex-1 flex-col bg-background"
    >
      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Открыть меню"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm font-semibold sm:text-[15px]">
              {activeThread?.title ?? "VibeFlow"}
            </h1>
            {activeThread && (
              <Badge
                variant="secondary"
                className="hidden shrink-0 rounded-full text-[11px] font-normal sm:inline-flex"
              >
                {MODE_LABELS[activeThread.mode]}
              </Badge>
            )}
          </div>
        </div>
        <Button
            variant="ghost"
            size="icon"
            className="hidden size-9 xl:inline-flex"
            onClick={onToggleContext}
            aria-label={
              contextOpen
                ? "Скрыть панель контекста"
                : "Показать панель контекста"
            }
          >
            {contextOpen ? (
              <PanelRight className="size-4" aria-hidden="true" />
            ) : (
              <PanelRightOpen className="size-4" aria-hidden="true" />
            )}
          </Button>
      </header>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="vf-scroll relative min-h-0 flex-1 overflow-y-auto"
      >
        {messagesLoading ? (
          <div className="mx-auto w-full max-w-3xl space-y-6 p-4">
            <Skeleton className="h-14 w-2/3" />
            <Skeleton className="ml-auto h-10 w-1/2" />
            <Skeleton className="h-14 w-3/4" />
          </div>
        ) : showWelcome ? (
          <Welcome />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-5 p-4 pb-6 sm:space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {thinking && <TypingIndicator />}
          </div>
        )}
      </div>

      {/* ── Jump to bottom ── */}
      {showJump && (
        <Button
          size="sm"
          variant="outline"
          onClick={jumpToBottom}
          aria-label="Прокрутить к новым сообщениям"
          className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 gap-1.5 rounded-full border-border bg-card shadow-md"
        >
          <ArrowDown className="size-3.5" aria-hidden="true" />
          к новым
        </Button>
      )}

      {/* ── Composer ── */}
      <Composer />

      {/* Screen-reader live region for streaming state */}
      <span aria-live="polite" className="sr-only">
        {busy ? "VibeFlow печатает" : ""}
      </span>
    </section>
  );
}

function TypingIndicator() {
  return (
    <div className="flex w-full items-start gap-2.5 sm:gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="text-xs">VibeFlow печатает</span>
        <span className="flex items-center gap-1 py-0.5">
          <span className="vf-dot" />
          <span className="vf-dot" />
          <span className="vf-dot" />
        </span>
      </div>
    </div>
  );
}
