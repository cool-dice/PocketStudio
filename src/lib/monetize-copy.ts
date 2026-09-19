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
