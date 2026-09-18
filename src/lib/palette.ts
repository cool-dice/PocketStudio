/**
 * Домен «Палитра стиля» (Фаза A, дизайн-модуль) — общий для сервера и клиента.
 *
 * Палитра живёт как Artifact (type "file", stage "style") c meta:
 *   { kind: "palette", mood, colors[], fonts{heading,body,note}, advice, brief }
 * LLM возвращает JSON по брифу; нормализация здесь гарантирует форму
 * (hex всегда #RRGGBB, строки обрезаны, мусор отброшен).
 */

import type { ArtifactDto } from "@/lib/workspace-types";

export interface PaletteColor {
  /** Всегда #RRGGBB (верхний регистр). */
  hex: string;
  /** Короткое русское название цвета. */
  name: string;
  /** Где использовать в проекте. */
  usage: string;
}

export interface PaletteFonts {
  heading: string;
  body: string;
  note: string;
}

export interface StylePalette {
  mood: string;
  colors: PaletteColor[];
  fonts: PaletteFonts;
  advice: string;
}

/** meta артефакта-палитры (то, что пишется в БД). */
export interface PaletteMeta extends StylePalette {
  kind: "palette";
  brief: string;
}

/* ─────────────────────────── нормализация ─────────────────────────── */

/** Строка → #RRGGBB или null (принимает «#abc», «abc», «#AABBCC»). */
export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const short = /^#?([0-9a-fA-F]{3})$/.exec(raw);
  if (short) {
    const [r, g, b] = short[1];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const full = /^#?([0-9a-fA-F]{6})$/.exec(raw);
  return full ? `#${full[1].toUpperCase()}` : null;
}

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Ответ LLM (или meta из БД) → StylePalette | null.
 * null = данных недостаточно (нет цветов или формат неузнаваем).
 */
export function normalizeStylePalette(raw: unknown): StylePalette | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const colorsRaw = Array.isArray(r.colors) ? r.colors : [];
  const colors: PaletteColor[] = [];
  for (const c of colorsRaw) {
    if (typeof c !== "object" || c === null) continue;
    const o = c as Record<string, unknown>;
    const hex = normalizeHex(o.hex);
    if (!hex) continue;
    colors.push({
      hex,
      name: str(o.name, 60) || hex,
      usage: str(o.usage, 200),
    });
    if (colors.length >= 8) break;
  }
  if (colors.length < 3) return null;

  const f = (typeof r.fonts === "object" && r.fonts !== null
    ? r.fonts
    : {}) as Record<string, unknown>;

  return {
    mood: str(r.mood, 300),
    colors,
    fonts: {
      heading: str(f.heading, 80),
      body: str(f.body, 80),
      note: str(f.note, 300),
    },
    advice: str(r.advice, 800),
  };
}

/**
 * Артефакт воркспейса → палитра, если это живой артефакт-палитра
 * (stage "style" + meta.kind "palette"). Иначе null.
 */
export function paletteFromArtifact(a: ArtifactDto): StylePalette | null {
  if (a.stage !== "style" || !a.meta) return null;
  const meta = a.meta as Record<string, unknown>;
  if (meta.kind !== "palette") return null;
  return normalizeStylePalette(meta);
}

/** Бриф, на основе которого палитра собрана (хранится в meta). */
export function briefFromArtifact(a: ArtifactDto): string | null {
  if (a.stage !== "style" || !a.meta) return null;
  const meta = a.meta as Record<string, unknown>;
  if (meta.kind !== "palette") return null;
  return typeof meta.brief === "string" ? meta.brief : a.prompt;
}

/* ─────────────────────────── утилиты отображения ─────────────────────────── */

/** Относительная светота HEX (0…1) — для контрастного текста на свотче. */
export function hexLuminance(hex: string): number {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return 0.5;
  const n = m[1];
  const channel = (i: number) => {
    const v = parseInt(n.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Тёмный ли цвет свотча → светлый текст, иначе тёмный. */
export function isHexDark(hex: string): boolean {
  return hexLuminance(hex) < 0.45;
}

/** Похоже ли название шрифта на антикву (для превью системным serif). */
export function looksSerif(name: string): boolean {
  return /serif|антикв|book|georgia|times|garamond|didot/i.test(name);
}
