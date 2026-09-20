import { describe, expect, test } from "bun:test";

import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import { NARRATION_VOICES, voiceLabel } from "@/components/studio/audio/narration-data";
import { VOICES, buildScenes } from "@/components/studio/video/video-data";
import type { ArtifactDto, DocumentSectionDto } from "@/lib/workspace-types";

import {
  AUDIO_LIBRARY_EMPTY,
  AUDIO_LIBRARY_LOAD_ERROR,
  AUDIO_LIBRARY_LOAD_ERROR_HINT,
  AUDIO_TTS_FAILED,
  AUDIO_TTS_FAILED_HINT,
  AUDIO_TTS_UNCONFIGURED_HINT,
  DAW_EMPTY_TRACKS,
  DAW_EMPTY_TRACKS_HINT,
  DAW_LOAD_ERROR,
  NARRATION_LIBRARY_EMPTY,
  NARRATION_LIBRARY_LOAD_ERROR,
  NARRATION_LIBRARY_LOAD_ERROR_HINT,
  VOICE_TRACK_EMPTY,
  VOICE_TRACK_LOAD_ERROR,
  VOICE_TRACK_LOAD_ERROR_HINT,
  playableAudioSrc,
  ttsPlaybackAfterAttempt,
} from "./audio-copy";

const ZAI_VOICE = /tongtong|chuichui|xiaochen|Тонгтунг|tong.?tong/i;
const OPENAI_UI_VOICES = [
  "alloy",
  "nova",
  "shimmer",
  "echo",
  "onyx",
  "fable",
  "sage",
] as const;

function section(id: string): DocumentSectionDto {
  return {
    id,
    documentId: "doc",
    title: "Пролог",
    order: 0,
    content: "маяк",
    status: "draft",
    wordsCount: 1,
    updatedAt: new Date().toISOString(),
  };
}

function artifact(
  partial: Partial<ArtifactDto> & Pick<ArtifactDto, "id" | "url">,
): ArtifactDto {
  return {
    projectId: "ws",
    type: "audio",
    title: "озвучка",
    description: null,
    prompt: null,
    entityId: null,
    stage: `voice:${partial.id}`,
    meta: null,
    favorite: false,
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("TTS / audio honesty copy", () => {
  test("library load error is not the empty-library message", () => {
    expect(AUDIO_LIBRARY_LOAD_ERROR).not.toBe(AUDIO_LIBRARY_EMPTY);
    expect(AUDIO_LIBRARY_LOAD_ERROR).not.toMatch(/пока нет/i);
    expect(AUDIO_LIBRARY_LOAD_ERROR_HINT).toMatch(/не пустая/i);
    expect(NARRATION_LIBRARY_LOAD_ERROR).not.toBe(NARRATION_LIBRARY_EMPTY);
    expect(NARRATION_LIBRARY_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(VOICE_TRACK_LOAD_ERROR).not.toBe(VOICE_TRACK_EMPTY);
    expect(VOICE_TRACK_LOAD_ERROR_HINT).toMatch(/не пустой/i);
    expect(DAW_EMPTY_TRACKS).not.toBe(DAW_LOAD_ERROR);
    expect(DAW_EMPTY_TRACKS_HINT).toMatch(/не ошибка загрузки/i);
    expect(DAW_LOAD_ERROR).toMatch(/не удалось загрузить/i);
    expect(AUDIO_LIBRARY_EMPTY).toMatch(/[А-Яа-яЁё]/);
    expect(AUDIO_LIBRARY_LOAD_ERROR).toMatch(/[А-Яа-яЁё]/);
  });

  test("failed TTS copy is not a ready/playing track", () => {
    expect(AUDIO_TTS_FAILED).toMatch(/не удалась/i);
    expect(AUDIO_TTS_FAILED_HINT).toMatch(/не сохранён|не воспроизводится/i);
    expect(AUDIO_TTS_FAILED_HINT).not.toMatch(/готова|играет|playing/i);
    expect(UNCONFIGURED_TOOL_MESSAGE).toMatch(/Администратор ещё не настроил/);
    expect(AUDIO_TTS_UNCONFIGURED_HINT).toMatch(/Модели ИИ/);
    expect(AUDIO_TTS_FAILED).not.toBe(UNCONFIGURED_TOOL_MESSAGE);
  });

  test("UI voices are OpenAI names, not Tongtong", () => {
    const uiIds = NARRATION_VOICES.map((v) => v.id);
    const uiBlob = NARRATION_VOICES.map((v) => `${v.id} ${v.name} ${v.note}`).join("\n");
    const videoBlob = VOICES.map((v) => `${v.id} ${v.label}`).join("\n");
    expect(uiIds).toEqual([...OPENAI_UI_VOICES]);
    expect(uiBlob).not.toMatch(ZAI_VOICE);
    expect(videoBlob).not.toMatch(ZAI_VOICE);
    expect(VOICES.map((v) => v.id)).toEqual([...OPENAI_UI_VOICES]);
    expect(voiceLabel("tongtong")).toMatch(/Alloy/);
    expect(voiceLabel("tongtong")).not.toMatch(ZAI_VOICE);
    expect(voiceLabel("alloy")).toMatch(/Alloy/);
  });

  test("failed TTS leaves playback idle, never a playing ghost", () => {
    expect(ttsPlaybackAfterAttempt(false)).toBe("idle");
    expect(ttsPlaybackAfterAttempt(true)).toBe("ready");
    expect(ttsPlaybackAfterAttempt(false)).not.toBe("busy");
    expect(playableAudioSrc(null)).toBeNull();
    expect(playableAudioSrc({ url: null })).toBeNull();
    expect(playableAudioSrc({ url: "/gen/x.wav", fileMissing: true })).toBeNull();
    expect(playableAudioSrc({ url: "/gen/x.wav" })).toBe("/gen/x.wav");
  });

  test("storyboard does not play a missing voice file", () => {
    const scenes = buildScenes(
      [section("s1")],
      [
        artifact({
          id: "a1",
          url: "/gen/gone.wav",
          fileMissing: true,
          stage: "voice:s1",
        }),
      ],
    );
    expect(scenes[0]?.voiceUrl).toBeNull();
    expect(scenes[0]?.voiceArtifact?.fileMissing).toBe(true);
  });
});
