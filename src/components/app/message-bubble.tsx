"use client";

/**
 * MessageBubble — user (right, emerald) / assistant (left, avatar + markdown).
 * Streaming assistant messages render animated dots while content is empty
 * and a blinking caret while deltas arrive.
 */

import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { Sparkles } from "lucide-react";

import { ToolCard } from "@/components/app/tool-card";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { stabilizeStreamingMarkdown } from "@/lib/streaming-markdown";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1.5 mt-3 text-[15px] font-semibold first:mt-0">
      {children}
    </h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 text-muted-foreground italic last:mb-0">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => (
    <pre className="vf-scroll mb-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed last:mb-0">
      {children}
    </pre>
  ),
  code: ({ children, className }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return <code className={cn("font-mono", className)}>{children}</code>;
    }
    return (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    );
  },
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";
  const time = formatTime(message.createdAt);

  // Agent tool call → compact system card (never looks like chat text).
  if (message.role === "tool") {
    return <ToolCard message={message} />;
  }

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="flex max-w-[85%] flex-col items-end sm:max-w-[75%]">
          <div
            className={cn(
              "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-primary-foreground transition-opacity duration-200",
              message.pending && "opacity-70",
            )}
          >
            {message.content}
          </div>
          <span className="mt-1 px-1 text-[11px] text-muted-foreground">
            {time}
            {message.pending ? " · отправляется…" : ""}
          </span>
        </div>
      </div>
    );
  }

  const isStreamingEmpty = message.streaming && message.content === "";
  const isUnconfigured = message.content === UNCONFIGURED_TOOL_MESSAGE;

  return (
    <div className="flex w-full items-start gap-2.5 sm:gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      >
        <Sparkles className="size-3.5" />
      </span>
      <div className="flex min-w-0 max-w-[85%] flex-col items-start sm:max-w-[75%]">
        <div
          className={cn(
            "w-full rounded-2xl rounded-bl-md border bg-card px-4 py-2.5 text-sm leading-relaxed",
            isUnconfigured && "border-destructive/40 text-destructive",
          )}
          role={isUnconfigured ? "alert" : undefined}
        >
          {isStreamingEmpty ? (
            <span className="flex items-center gap-1.5 py-0.5 text-muted-foreground">
              <span className="vf-dot" />
              <span className="vf-dot" />
              <span className="vf-dot" />
            </span>
          ) : (
            <div className="min-w-0">
              <ReactMarkdown components={markdownComponents}>
                {message.streaming
                  ? stabilizeStreamingMarkdown(message.content)
                  : message.content}
              </ReactMarkdown>
              {message.streaming && <span className="vf-caret" aria-hidden="true" />}
            </div>
          )}
        </div>
        <span className="mt-1 px-1 text-[11px] text-muted-foreground">
          Студия · {time}
        </span>
      </div>
    </div>
  );
});
