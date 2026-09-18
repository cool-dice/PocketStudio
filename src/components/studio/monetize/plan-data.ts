/**
 * Monetize (5-c) — типы и парсеры LLM-плана монетизации.
 *
 * План хранится как Document kind="spec" с секциями «Концепция»,
 * «Продукты и цены», «Каналы», «План запуска», «Прогноз». Первой строкой
 * content секции идёт JSON-маркер (ПРОДУКТЫ_JSON:[…] и т.п.), дальше —
 * человекочитаемый текст: маркер парсится на клиенте для красивых
 * карточек, текст остаётся читаемым в редакторе документов.
 */

import type { DocumentDto } from "@/lib/workspace-types";

export interface PlanProduct {
  name: string;
  price: string;
  note: string;
}

export interface PlanChannel {
  name: string;
  note: string;
}

export interface PlanStep {
  term: string;
  note: string;
}

export interface PlanForecast {
  assumption: string;
  monthly: { label: string; amount: number }[];
}

export interface MonetizePlan {
  concept: string;
  products: PlanProduct[];
  channels: PlanChannel[];
  steps: PlanStep[];
  forecast: PlanForecast | null;
}

/** Префикс title план-документа (синхронизирован с /api/ai/monetize). */
export const PLAN_DOC_TITLE_PREFIX = "План монетизации";

/** План-документ: spec с title «План монетизации …». */
export function isPlanDocument(doc: DocumentDto): boolean {
  return (
    doc.kind === "spec" && doc.title.startsWith(PLAN_DOC_TITLE_PREFIX)
  );
}

/** Бриф из description план-документа («Бриф: …»). */
export function briefFromDocument(doc: DocumentDto | null): string {
  const raw = doc?.description ?? "";
  if (raw.startsWith("Бриф:")) return raw.slice(5).trim();
  return "";
}

const MARKER_RE = /^(ПРОДУКТЫ|КАНАЛЫ|ШАГИ|ПРОГНОЗ)_JSON:/;

/** Достать JSON-массив/объект из строки-маркера (первая строка content). */
function markerJson<T>(content: string): T | null {
  const firstLine = content.split("\n", 1)[0] ?? "";
  if (!MARKER_RE.test(firstLine)) return null;
  const raw = firstLine.slice(firstLine.indexOf(":") + 1).trim();
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Человекочитаемый текст секции без JSON-маркера. */
export function sectionText(content: string): string {
  return content
    .split("\n")
    .filter((line) => !MARKER_RE.test(line))
    .join("\n")
    .trim();
}

function planString(value: unknown, max = 300): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function planNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/** Собрать план из секций план-документа (мягкий парсинг маркеров). */
export function planFromDocument(doc: DocumentDto): MonetizePlan | null {
  const sections = doc.sections ?? [];
  if (sections.length === 0) return null;

  const byTitle = (title: string) =>
    sections.find((s) => s.title === title)?.content ?? "";

  const concept = sectionText(byTitle("Концепция"));

  const productsRaw = markerJson<unknown[]>(byTitle("Продукты и цены")) ?? [];
  const products = productsRaw
    .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
    .map((p) => ({
      name: planString(p.name, 120),
      price: planString(p.price, 40),
      note: planString(p.note, 400),
    }))
    .filter((p) => p.name.length > 0);

  const channelsRaw = markerJson<unknown[]>(byTitle("Каналы")) ?? [];
  const channels = channelsRaw
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({ name: planString(c.name, 120), note: planString(c.note, 400) }))
    .filter((c) => c.name.length > 0);

  const stepsRaw = markerJson<unknown[]>(byTitle("План запуска")) ?? [];
  const steps = stepsRaw
    .filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
    .map((s) => ({ term: planString(s.term, 60), note: planString(s.note, 400) }))
    .filter((s) => s.note.length > 0);

  let forecast: PlanForecast | null = null;
  const forecastRaw = markerJson<Record<string, unknown>>(byTitle("Прогноз"));
  if (forecastRaw) {
    const monthly = (Array.isArray(forecastRaw.monthly) ? forecastRaw.monthly : [])
      .filter((m): m is Record<string, unknown> => typeof m === "object" && m !== null)
      .map((m) => ({
        label: planString(m.label, 40) || "Месяц",
        amount: planNumber(m.amount),
      }));
    forecast = {
      assumption: planString(forecastRaw.assumption, 400),
      monthly,
    };
  }

  if (!concept && products.length === 0 && steps.length === 0) return null;

  return { concept, products, channels, steps, forecast };
}

/** Формат суммы в рублях. */
export function formatRub(amount: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(Math.round(amount))} ₽`;
}
