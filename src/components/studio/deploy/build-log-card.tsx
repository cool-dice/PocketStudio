"use client";

/**
 * Build log preview — dark monospace block. Lines appear as the
 * fake pipeline progresses; the container auto-scrolls to bottom.
 */

import { useEffect, useMemo, useRef } from "react";
import { SquareTerminal } from "lucide-react";

import {
  LOG_BUILD_STEPS,
  LOG_CMD_BUILD,
  LOG_CMD_PUSH,
  LOG_CMD_SSH,
  LOG_DONE,
  LOG_IDLE_HINT,
  LOG_TESTS_DONE,
  type LogLine,
  type StepStatus,
} from "./deploy-data";
import { CopyButton } from "./deploy-bits";
import { cn } from "@/lib/utils";

const LINE_TONE: Record<LogLine["kind"], string> = {
  cmd: "text-stone-300",
  ok: "text-emerald-300/90",
  info: "text-stone-500 italic",
};

function LogLineView({ line }: { line: LogLine }) {
  return (
    <p className={cn("whitespace-pre-wrap break-all", LINE_TONE[line.kind])}>
      {line.text}
    </p>
  );
}

export function BuildLogCard({ statuses }: { statuses: StepStatus[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const lines = useMemo<LogLine[]>(() => {
    const started = statuses.some((s) => s !== "idle");
    if (!started) return [LOG_IDLE_HINT];

    const [build, tests, registry, host] = statuses;
    const out: LogLine[] = [LOG_CMD_BUILD];
    if (build === "done") out.push(...LOG_BUILD_STEPS);
    if (tests === "done") out.push(LOG_TESTS_DONE);
    if (registry !== "idle") out.push(LOG_CMD_PUSH);
    if (host !== "idle") out.push(LOG_CMD_SSH);
    if (host === "done") out.push(LOG_DONE);
    return out;
  }, [statuses]);

  const running = statuses.some((s) => s === "running" || s === "idle");

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const rawLog = lines.map((l) => l.text).join("\n");

  return (
    <section
      aria-label="Журнал сборки"
      className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-red-400/80" />
            <span className="size-2.5 rounded-full bg-amber-400/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
          </span>
          <h2 className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Журнал сборки
          </h2>
        </div>
        <CopyButton text={rawLog} label="Скопировать журнал сборки" />
      </div>

      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto vf-scroll rounded-lg bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-200 selection:bg-emerald-500/30"
        tabIndex={0}
        role="log"
        aria-label="Вывод команды docker build"
        aria-live="polite"
      >
        {lines.map((line, i) => (
          <LogLineView key={`${i}-${line.text}`} line={line} />
        ))}
        {running ? (
          <p>
            <span
              className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-[1px] bg-emerald-400/80 align-[-2px]"
              aria-hidden="true"
            />
            <span className="sr-only">сборка выполняется</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
