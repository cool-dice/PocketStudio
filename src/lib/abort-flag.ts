/**
 * Cooperative abort for agent turns.
 *
 * Client `turn:abort` → AbortController in agent-service → LLM fetch,
 * retrieve/embed, HTTP tools, and file mutations check this flag.
 * A tool that already committed (write/delete) is NOT rolled back —
 * the loop just stops.
 */

export const ABORT_MESSAGE = "Генерация остановлена";
export const ABORT_STATUS = 499;

export type AbortedToolResult = { error: string; aborted: true };

export function abortError(message = ABORT_MESSAGE): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.name = "AbortError";
  err.status = ABORT_STATUS;
  return err;
}

export function isAbortFlag(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; status?: number; message?: string };
  return (
    e.name === "AbortError" ||
    e.status === ABORT_STATUS ||
    e.message === ABORT_MESSAGE
  );
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

export function abortedToolResult(): AbortedToolResult {
  return { error: ABORT_MESSAGE, aborted: true };
}

export function toolResultWasAborted(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as { aborted?: unknown; error?: unknown };
  return r.aborted === true || r.error === ABORT_MESSAGE;
}

/** True when the tool finished a side-effect (file write, note, etc.). */
export function toolCallCommitted(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as { error?: unknown; aborted?: unknown };
  return r.error === undefined && r.aborted !== true;
}

export type TurnAfterTool = "continue" | "stop" | "stop-keep-writes";

/**
 * After a tool returns: abort stops the loop. Committed writes stay.
 * Uncommitted / aborted tools just stop — no global rollback.
 */
export function decideAfterTool(opts: {
  signalAborted: boolean;
  result: unknown;
}): TurnAfterTool {
  const committed = toolCallCommitted(opts.result);
  const aborted =
    opts.signalAborted || toolResultWasAborted(opts.result);
  if (!aborted) return "continue";
  return committed ? "stop-keep-writes" : "stop";
}

/** Combine timeout + turn abort into one signal for fetch/exec. */
export function mergeAbortSignals(
  signals: Array<AbortSignal | undefined>,
): AbortSignal {
  const live = signals.filter((s): s is AbortSignal => Boolean(s));
  if (live.length === 0) return new AbortController().signal;
  if (live.length === 1) return live[0]!;
  const anyFn = (
    AbortSignal as typeof AbortSignal & {
      any?: (s: AbortSignal[]) => AbortSignal;
    }
  ).any;
  if (typeof anyFn === "function") return anyFn(live);
  const ac = new AbortController();
  for (const s of live) {
    if (s.aborted) {
      ac.abort();
      break;
    }
    s.addEventListener("abort", () => ac.abort(), { once: true });
  }
  return ac.signal;
}

export function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
