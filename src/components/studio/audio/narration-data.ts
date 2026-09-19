/**
 * Живая озвучка: справочник голосов TTS шлюза (OpenAI-совместимые имена).
 * Старые идентификаторы z-ai (tongtong…) по-прежнему принимаются API
 * и отображаются через voiceLabel(), но в панели выбора их нет.
 */

export type NarrationVoiceId =
  | "alloy"
  | "nova"
  | "shimmer"
  | "echo"
  | "onyx"
  | "fable"
  | "sage";

export interface NarrationVoice {
  id: NarrationVoiceId;
  /** Русское имя голоса для карточки выбора. */
  name: string;
  /** Короткая характеристика. */
  note: string;
  /** Градиент аватара (без синего/индиго). */
  gradient: string;
  initials: string;
}

export const NARRATION_VOICES: readonly NarrationVoice[] = [
  {
    id: "alloy",
    name: "Alloy",
    note: "нейтральный",
    gradient: "linear-gradient(135deg,#34d399,#059669)",
    initials: "A",
  },
  {
    id: "nova",
    name: "Nova",
    note: "яркий",
    gradient: "linear-gradient(135deg,#fbbf24,#d97706)",
    initials: "N",
  },
  {
    id: "shimmer",
    name: "Shimmer",
    note: "мягкий",
    gradient: "linear-gradient(135deg,#fb7185,#be123c)",
    initials: "S",
  },
  {
    id: "echo",
    name: "Echo",
    note: "спокойный",
    gradient: "linear-gradient(135deg,#a1a1aa,#3f3f46)",
    initials: "E",
  },
  {
    id: "onyx",
    name: "Onyx",
    note: "глубокий",
    gradient: "linear-gradient(135deg,#b45309,#7c2d12)",
    initials: "O",
  },
  {
    id: "fable",
    name: "Fable",
    note: "рассказчик",
    gradient: "linear-gradient(135deg,#2dd4bf,#0d9488)",
    initials: "F",
  },
  {
    id: "sage",
    name: "Sage",
    note: "ровный",
    gradient: "linear-gradient(135deg,#a78bfa,#7c3aed)",
    initials: "Sg",
  },
];

const LEGACY_VOICE_LABELS: Record<string, string> = {
  tongtong: "Alloy — нейтральный",
  chuichui: "Nova — яркий",
  xiaochen: "Shimmer — мягкий",
  jam: "Echo — спокойный",
  kazi: "Onyx — глубокий",
  douji: "Fable — рассказчик",
  luodo: "Sage — ровный",
};

/** Подпись голоса для карточек библиотеки. */
export function voiceLabel(voice: unknown): string {
  const v = NARRATION_VOICES.find((x) => x.id === voice);
  if (v) return `${v.name} — ${v.note}`;
  if (typeof voice === "string" && LEGACY_VOICE_LABELS[voice]) {
    return LEGACY_VOICE_LABELS[voice];
  }
  return "Голос студии";
}

/** Лимит текста озвучки (как в REST /api/ai/tts). */
export const NARRATION_MAX_CHARS = 4000;

/** 1 → «1×», 0.75 → «0,75×» — по-русски, с запятой. */
export function formatSpeed(v: number): string {
  return `${String(v).replace(".", ",")}×`;
}

/** Дата артефакта по-русски: «12 мая, 14:30» (+год, если не текущий). */
export function formatNarrationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return formatted;
}
