/**
 * Видео (Task 5-b): типы и хелперы студии раскадровки.
 *
 * Сцена = секция документа-сценария (kind "script"). Кадр сцены и озвучка
 * сцены — артефакты воркспейса, привязанные к секции через stage-метки
 * `scene:{sectionId}` (изображение) и `voice:{sectionId}` (аудио):
 * несколько генераций одной роли → выигрывает самая свежая.
 */

import type { ArtifactDto, DocumentSectionDto } from "@/lib/workspace-types";

/** Сцена раскадровки: секция сценария + готовые кадр/озвучка (если есть). */
export interface VideoScene {
  section: DocumentSectionDto;
  imageArtifact: ArtifactDto | null;
  imageUrl: string | null;
  voiceArtifact: ArtifactDto | null;
  voiceUrl: string | null;
}

/** stage-префикс кадра сцены (artifact.stage). */
export const SCENE_STAGE_PREFIX = "scene:";
/** stage-префикс озвучки сцены (artifact.stage). */
export const VOICE_STAGE_PREFIX = "voice:";

/** Кадры сцен генерируются широкоформатными (16:9). */
export const SCENE_IMAGE_SIZE = "1440x720";

/** Сцена без озвучки живёт в плеере 4 секунды. */
export const NO_AUDIO_SCENE_MS = 4_000;

/** Дебаунс автосохранения текста сцены. */
export const SCENE_AUTOSAVE_MS = 800;

export function sceneStage(sectionId: string): string {
  return `${SCENE_STAGE_PREFIX}${sectionId}`;
}

export function voiceStage(sectionId: string): string {
  return `${VOICE_STAGE_PREFIX}${sectionId}`;
}

/** stage-метка раскадровки артефакта (кадр/озвучка сцены) или null. */
export function storyboardStage(artifact: ArtifactDto): string | null {
  const stage = artifact.stage;
  if (!stage || !artifact.url) return null;
  return stage.startsWith(SCENE_STAGE_PREFIX) || stage.startsWith(VOICE_STAGE_PREFIX)
    ? stage
    : null;
}

/** Сцены из секций сценария: артефакты раскладываются по stage-меткам. */
export function buildScenes(
  sections: DocumentSectionDto[],
  artifacts: ArtifactDto[],
): VideoScene[] {
  const byStage = new Map<string, ArtifactDto>();
  for (const artifact of artifacts) {
    const stage = storyboardStage(artifact);
    if (!stage) continue;
    const current = byStage.get(stage);
    if (
      !current ||
      Date.parse(artifact.createdAt) >= Date.parse(current.createdAt)
    ) {
      byStage.set(stage, artifact);
    }
  }
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  return ordered.map((section) => {
    const image = byStage.get(sceneStage(section.id)) ?? null;
    const voice = byStage.get(voiceStage(section.id)) ?? null;
    return {
      section,
      imageArtifact: image,
      imageUrl: image?.url ?? null,
      voiceArtifact: voice,
      voiceUrl: voice?.url ?? null,
    };
  });
}

/** Сцена готова к сборке: есть и кадр, и озвучка. */
export function sceneReady(scene: VideoScene): boolean {
  return Boolean(scene.imageUrl && scene.voiceUrl);
}

/** Голоса TTS — OpenAI-совместимые id (шлюз мапит старые z-ai имена). */
export const VOICES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "alloy", label: "Alloy · нейтральный" },
  { id: "nova", label: "Nova · яркий" },
  { id: "shimmer", label: "Shimmer · мягкий" },
  { id: "echo", label: "Echo · спокойный" },
  { id: "onyx", label: "Onyx · глубокий" },
  { id: "fable", label: "Fable · рассказчик" },
  { id: "sage", label: "Sage · ровный" },
];
