/**
 * Honest pipeline stage PATCH: only labels (and 1-based indexes) that
 * belong to this workspace type. Legacy «Публикация» maps to «Выпуск».
 */

import {
  WORKSPACE_STAGES,
  canonicalStageLabel,
  pipelineStageIndex,
  type WorkspaceType,
} from "@/lib/workspace-data";

export const PIPELINE_STAGE_UNKNOWN =
  "Неизвестная стадия пайплайна этого типа";
export const PIPELINE_STAGE_INDEX_RANGE =
  "Индекс стадии вне пайплайна этого типа";
export const PIPELINE_STAGE_MISMATCH = "Стадия и индекс не совпадают";
export const PIPELINE_STAGE_SAVED = "Стадия обновлена";
export const PIPELINE_STAGE_SAVE_FAILED = "Не удалось сменить стадию";

export type PipelineStagePatchInput = {
  stage?: string;
  stageIndex?: number;
};

export type PipelineStagePatchResult =
  | { ok: true; skip: true }
  | { ok: true; skip: false; stage: string; stageIndex: number }
  | { ok: false; error: string };

export function resolvePipelineStagePatch(
  type: WorkspaceType,
  input: PipelineStagePatchInput,
): PipelineStagePatchResult {
  const stages = WORKSPACE_STAGES[type] ?? WORKSPACE_STAGES.universal;
  const hasStage = input.stage !== undefined;
  const hasIndex = input.stageIndex !== undefined;
  if (!hasStage && !hasIndex) return { ok: true, skip: true };

  if (hasStage) {
    const label = canonicalStageLabel(input.stage!.trim());
    if (!label) return { ok: false, error: PIPELINE_STAGE_UNKNOWN };
    const idx = pipelineStageIndex(stages, label);
    if (idx < 0) return { ok: false, error: PIPELINE_STAGE_UNKNOWN };
    const stageIndex = idx + 1;
    if (hasIndex && input.stageIndex !== stageIndex) {
      return { ok: false, error: PIPELINE_STAGE_MISMATCH };
    }
    return { ok: true, skip: false, stage: stages[idx], stageIndex };
  }

  const i = input.stageIndex!;
  if (!Number.isInteger(i) || i < 1 || i > stages.length) {
    return { ok: false, error: PIPELINE_STAGE_INDEX_RANGE };
  }
  return { ok: true, skip: false, stage: stages[i - 1], stageIndex: i };
}
