/**
 * Live SSE → socket forwarding for one LLM call.
 * Pure: no DB / socket. server.ts emits start/delta from the decisions.
 *
 * Peek until the first non-empty token. JSON/fence tool candidates are
 * held so a tool turn never paints `{` in the chat bubble. After a tool,
 * resetLiveBubble so the next prose stream is a new message.
 */

import { looksLikeToolStart, parseToolCall } from "./agent";

export interface LiveStream {
  messageId: string | null;
  mode: "peek" | "text" | "tool";
  acc: string;
  emittedLen: number;
  persist: Promise<void>;
}

export function newLiveStream(): LiveStream {
  return {
    messageId: null,
    mode: "peek",
    acc: "",
    emittedLen: 0,
    persist: Promise.resolve(),
  };
}

/** Between LLM calls of the same bubble (should not happen after a tool). */
export function resetLiveCall(live: LiveStream): void {
  live.acc = "";
  live.mode = "peek";
  live.emittedLen = 0;
}

/** After closing a streamed bubble (tool follows, or a later stream). */
export function resetLiveBubble(live: LiveStream): void {
  live.acc = "";
  live.mode = "peek";
  live.emittedLen = 0;
  live.messageId = null;
  live.persist = Promise.resolve();
}

const TOOL_OBJECT = /\{\s*"(?:tool|name|function)"/;
const TOOL_FENCE =
  /```(?:json|javascript|js)?\s*\r?\n\s*\{\s*"(?:tool|name|function)"/i;

export function indexOfToolStart(text: string): number {
  if (!text) return -1;
  const lead = text.search(/\S/);
  if (lead >= 0 && looksLikeToolStart(text.slice(lead))) return lead;
  const fence = text.search(TOOL_FENCE);
  const obj = text.search(TOOL_OBJECT);
  const hits = [fence, obj].filter((i) => i >= 0);
  if (hits.length === 0) return -1;
  return Math.min(...hits);
}

function holdIndex(acc: string): number {
  const at = indexOfToolStart(acc);
  if (at >= 0) return at;
  const fence = acc.lastIndexOf("```");
  if (fence >= 0) {
    const rest = acc.slice(fence);
    if (/^```(?:json|javascript|js)?\s*$/i.test(rest) || looksLikeToolStart(rest)) {
      return fence;
    }
  }
  const brace = acc.lastIndexOf("{");
  if (brace < 0) return -1;
  const rest = acc.slice(brace);
  if (
    /^\{\s*$/.test(rest) ||
    /^\{\s*"$/.test(rest) ||
    /^\{\s*"(?:tool|name|function)/.test(rest)
  ) {
    return brace;
  }
  return -1;
}

export interface LiveDeltaDecision {
  emitStart: boolean;
  emitDelta: string | null;
}

export function decideLiveDelta(
  live: LiveStream,
  delta: string,
): LiveDeltaDecision {
  if (typeof delta !== "string" || !delta) {
    return { emitStart: false, emitDelta: null };
  }
  live.acc += delta;
  if (live.mode === "tool") {
    return { emitStart: false, emitDelta: null };
  }

  const trimmed = live.acc.trimStart();
  if (!trimmed) return { emitStart: false, emitDelta: null };

  if (live.mode === "peek" && looksLikeToolStart(trimmed)) {
    live.mode = "tool";
    return { emitStart: false, emitDelta: null };
  }

  const hold = holdIndex(live.acc);
  if (hold >= 0) {
    const rest = live.acc.slice(hold);
    if (looksLikeToolStart(rest.trimStart()) || parseToolCall(rest)) {
      live.mode = "tool";
    }
  }
  const safeEnd = hold < 0 ? live.acc.length : hold;
  if (safeEnd <= live.emittedLen) {
    return { emitStart: false, emitDelta: null };
  }
  const piece = live.acc.slice(live.emittedLen, safeEnd);
  const starting = live.emittedLen === 0;
  live.emittedLen = safeEnd;
  if (live.mode !== "tool") live.mode = "text";
  return { emitStart: starting && Boolean(piece), emitDelta: piece || null };
}

export function proseFromMixed(raw: string, acc: string): string {
  const src = (acc && acc.trim() ? acc : raw) ?? "";
  const at = indexOfToolStart(src);
  return (at >= 0 ? src.slice(0, at) : src).trim();
}

/** Text already forwarded to the UI (never includes held tool JSON). */
export function streamedProseSoFar(live: LiveStream): string {
  if (!live.messageId || live.emittedLen <= 0) return "";
  return live.acc.slice(0, live.emittedLen).trim();
}
