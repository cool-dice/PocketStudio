/**
 * Honest monetize-plan copy. Unconfigured LLM is not a ready plan;
 * load failure is not an empty cabinet.
 */

import { UNCONFIGURED_TOOL_MESSAGE } from "./ai/tools";

export const MONETIZE_PLAN_FAILED = "Не удалось собрать план";
export const MONETIZE_PLAN_FAILED_HINT =
  "Модель не собрала план — попробуйте ещё раз.";
export const MONETIZE_UNCONFIGURED_HINT =
  "Откройте Админ → Модели ИИ и назначьте модель для плана монетизации.";

export function monetizeGenerateErrorHint(message: string): string {
  return message === UNCONFIGURED_TOOL_MESSAGE
    ? MONETIZE_UNCONFIGURED_HINT
    : MONETIZE_PLAN_FAILED_HINT;
}

export const MONETIZE_ASSETS_TITLE = "Готовые файлы воркспейса";
export const MONETIZE_ASSETS_HINT =
  "Артефакты с файлом — открыть или скачать. Это не публикация на хост.";
export const MONETIZE_ASSETS_EMPTY = "В воркспейсе пока нет артефактов";
export const MONETIZE_ASSETS_NO_FILE =
  "Файлов пока нет — только концепты без url";
