/**
 * Живая озвучка (Фаза A): справочник голосов TTS и утилиты отображения.
 *
 * Идентификаторы голосов соответствуют серверному allowlistу TTS_VOICES
 * (src/lib/ai/index.ts — tongtong…luodo): фронт отправляет их в
 * POST /api/ai/tts, сервер возвращает meta.voice, библиотека ниже
 * рисует подпись через voiceLabel().
 */

export type NarrationVoiceId =
  | "tongtong"
  | "chuichui"
  | "xiaochen"
  | "jam"
  | "kazi"
  | "douji"
  | "luodo";

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
    id: "tongtong",
    name: "Тонгтунг",
    note: "мягкий",
    gradient: "linear-gradient(135deg,#34d399,#059669)",
    initials: "Т",
  },
  {
    id: "chuichui",
    name: "Чуйчуй",
    note: "тёплый",
    gradient: "linear-gradient(135deg,#fbbf24,#d97706)",
    initials: "Ч",
  },
  {
    id: "xiaochen",
    name: "Сяочэнь",
    note: "женский",
    gradient: "linear-gradient(135deg,#fb7185,#be123c)",
    initials: "С",
  },
  {
    id: "jam",
    name: "Джэм",
    note: "мужской",
    gradient: "linear-gradient(135deg,#a1a1aa,#3f3f46)",
    initials: "Дж",
  },
  {
    id: "kazi",
    name: "Кази",
    note: "глубокий",
    gradient: "linear-gradient(135deg,#b45309,#7c2d12)",
    initials: "К",
  },
  {
    id: "douji",
    name: "Доуцзи",
    note: "юный",
    gradient: "linear-gradient(135deg,#2dd4bf,#0d9488)",
    initials: "До",
  },
  {
    id: "luodo",
    name: "Луодо",
    note: "спокойный",
    gradient: "linear-gradient(135deg,#a78bfa,#7c3aed)",
    initials: "Л",
  },
];

/** Подпись голоса для карточек библиотеки: «Джэм — мужской». */
export function voiceLabel(voice: unknown): string {
  const v = NARRATION_VOICES.find((x) => x.id === voice);
  return v ? `${v.name} — ${v.note}` : "Голос студии";
}

/** Лимит текста озвучки (как в REST /api/ai/tts). */
export const NARRATION_MAX_CHARS = 4000;

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
