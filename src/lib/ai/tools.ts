/**
 * Studio AI tools — shared by Next API routes and agent-service.
 * No "@/..." aliases, no framework imports.
 */

export const AI_TOOL_IDS = [
  "agent",
  "notes",
  "document_check",
  "describe",
  "palette",
  "monetize",
  "rewrite_section",
  "image",
  "tts",
  "asr",
] as const;

export type AiToolId = (typeof AI_TOOL_IDS)[number];

export type AiCapability = "chat" | "image" | "tts" | "asr" | "embeddings";

export interface AiToolDef {
  id: AiToolId;
  label: string;
  description: string;
  capability: AiCapability;
}

export const AI_TOOLS: readonly AiToolDef[] = [
  {
    id: "agent",
    label: "Агент / чат",
    description: "Оркестратор студии: диалог, инструменты, план и ревью",
    capability: "chat",
  },
  {
    id: "notes",
    label: "Анализ заметок",
    description: "Четыре блока разбора мысли в блокноте",
    capability: "chat",
  },
  {
    id: "document_check",
    label: "Проверка документа",
    description: "Аналитик: противоречия, недосказанности, расхождения",
    capability: "chat",
  },
  {
    id: "describe",
    label: "Описание сущностей",
    description: "Тексты карточек персонажей, лора и требований",
    capability: "chat",
  },
  {
    id: "palette",
    label: "Палитра стиля",
    description: "Цвета, шрифты и советы арт-директора",
    capability: "chat",
  },
  {
    id: "monetize",
    label: "План монетизации",
    description: "Продукты, каналы и прогноз дохода по воркспейсу",
    capability: "chat",
  },
  {
    id: "rewrite_section",
    label: "Написать / переписать главу",
    description: "Черновик, перепись и продолжение глав документов",
    capability: "chat",
  },
  {
    id: "image",
    label: "Генерация изображений",
    description: "Картинки, портреты, кадры раскадровки",
    capability: "image",
  },
  {
    id: "tts",
    label: "Озвучка",
    description: "Text-to-speech для сцен и библиотеки",
    capability: "tts",
  },
  {
    id: "asr",
    label: "Распознавание речи",
    description: "Голосовые заметки → текст",
    capability: "asr",
  },
];

export const AI_TOOL_BY_ID: Record<AiToolId, AiToolDef> = Object.fromEntries(
  AI_TOOLS.map((t) => [t.id, t]),
) as Record<AiToolId, AiToolDef>;

export function isAiToolId(value: unknown): value is AiToolId {
  return typeof value === "string" && (AI_TOOL_IDS as readonly string[]).includes(value);
}

export const PROVIDER_KINDS = ["openai_compatible", "anthropic_compatible"] as const;
export type ProviderKind = (typeof PROVIDER_KINDS)[number];

export function isProviderKind(value: unknown): value is ProviderKind {
  return (
    typeof value === "string" &&
    (PROVIDER_KINDS as readonly string[]).includes(value)
  );
}

export const UNCONFIGURED_TOOL_MESSAGE =
  "Администратор ещё не настроил модель для этого инструмента";

export const ANTHROPIC_NO_IMAGE_MESSAGE =
  "Провайдер Anthropic не умеет генерировать изображения. Выберите OpenAI-совместимую модель для этого инструмента.";

export const ANTHROPIC_NO_TTS_MESSAGE =
  "Провайдер Anthropic не умеет озвучивать текст. Выберите OpenAI-совместимую модель для этого инструмента.";

export const ANTHROPIC_NO_ASR_MESSAGE =
  "Провайдер Anthropic не умеет распознавать речь. Выберите OpenAI-совместимую модель для этого инструмента.";
