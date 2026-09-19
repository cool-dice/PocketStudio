/**
 * Shared HTTP helpers for the AI connector.
 * No "@/..." aliases.
 */

import { GatewayError, mapProviderHttpError, redactSecrets } from "./errors";

export const DEFAULT_TIMEOUT_MS = 90_000;
export const IMAGE_TIMEOUT_MS = 120_000;
export const SPEECH_TIMEOUT_MS = 90_000;

export function joinUrl(base: string, ...parts: string[]): string {
  let url = base.trim().replace(/\/+$/, "");
  for (const part of parts) {
    const p = part.replace(/^\/+/, "");
    if (p) url += `/${p}`;
  }
  return url;
}

export function assertHttpUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new GatewayError("Укажите корректный URL провайдера (http или https)", 400);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new GatewayError("URL провайдера должен начинаться с http:// или https://", 400);
  }
  return url.toString().replace(/\/+$/, "");
}

export function parseExtraHeaders(raw: string | null | undefined): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string" && k.trim()) out[k.trim()] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const external = init.signal;
  const onExternal = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener("abort", onExternal);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      if (external?.aborted) {
        throw new GatewayError("Генерация остановлена", 499);
      }
      throw new GatewayError("Провайдер не ответил вовремя", 504);
    }
    const msg = err instanceof Error ? redactSecrets(err.message) : "сеть";
    throw new GatewayError(`Не удалось связаться с провайдером (${msg})`, 502);
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternal);
  }
}

/**
 * Like fetchWithTimeout, but the abort/timeout stay attached until the
 * caller finishes reading `res.body`. Required for native SSE streaming —
 * the header-only helper would drop the listener after headers arrive.
 */
export async function fetchForStream(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ res: Response; dispose: () => void }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const external = init.signal;
  const onExternal = () => controller.abort();
  if (external?.aborted) controller.abort();
  else external?.addEventListener("abort", onExternal);

  const dispose = () => {
    clearTimeout(timer);
    external?.removeEventListener("abort", onExternal);
  };

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return { res, dispose };
  } catch (err) {
    dispose();
    if (err instanceof Error && err.name === "AbortError") {
      if (external?.aborted) {
        throw new GatewayError("Генерация остановлена", 499);
      }
      throw new GatewayError("Провайдер не ответил вовремя", 504);
    }
    const msg = err instanceof Error ? redactSecrets(err.message) : "сеть";
    throw new GatewayError(`Не удалось связаться с провайдером (${msg})`, 502);
  }
}

export async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return redactSecrets(text);
  } catch {
    return "";
  }
}

export async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const body = await readErrorBody(res);
  throw mapProviderHttpError(res.status, body);
}
