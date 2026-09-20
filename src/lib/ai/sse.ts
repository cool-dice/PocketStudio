/**
 * Minimal SSE parser for OpenAI- and Anthropic-compatible chat streams.
 * Reassembles frames split across TCP chunks. Abort cancels the reader.
 */

import { GatewayError } from "./errors";

function abortError(signal?: AbortSignal): GatewayError {
  if (signal?.aborted) return new GatewayError("Генерация остановлена", 499);
  return new GatewayError("Провайдер не ответил вовремя", 504);
}

function parseDataLine(line: string): unknown | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return undefined;
  const payload = trimmed.slice("data:".length).trim();
  if (!payload || payload === "[DONE]") return undefined;
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Yield one parsed JSON object per `data: {…}` line.
 * Heartbeats, comments, `event:` lines, and `data: [DONE]` are skipped.
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  if (signal?.aborted) {
    await reader.cancel().catch(() => {});
    throw abortError(signal);
  }
  signal?.addEventListener("abort", onAbort);
  try {
    for (;;) {
      if (signal?.aborted) throw abortError(signal);
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const parsed = parseDataLine(line);
        if (parsed !== undefined) yield parsed;
      }
    }
    const tail = parseDataLine(buffer);
    if (tail !== undefined) yield tail;
  } catch (err) {
    if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      throw abortError(signal);
    }
    throw err;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      /* already cancelled */
    }
  }
}
