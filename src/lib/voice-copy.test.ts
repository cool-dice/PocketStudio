import { describe, expect, test } from "bun:test";

import {
  ASR_EMPTY,
  ASR_GENERIC,
  ASR_UNAVAILABLE,
  MIC_PERMISSION_DENIED,
  MIC_START_FAILED,
  VOICE_RECOGNIZED,
  isUsableTranscript,
  voiceResultCopy,
} from "./voice-copy";

const FAKE_SUCCESS = /успешно записано/i;

describe("voice capture honesty", () => {
  test("error copy is Russian and never claims a saved recording", () => {
    const errors = [
      MIC_PERMISSION_DENIED,
      MIC_START_FAILED,
      ASR_EMPTY,
      ASR_UNAVAILABLE,
      ASR_GENERIC,
    ].join("\n");
    expect(errors).toMatch(/[А-Яа-яЁё]/);
    expect(errors).not.toMatch(FAKE_SUCCESS);
    expect(errors).not.toMatch(/successfully recorded|saved note/i);
  });

  test("empty and stub transcripts are not success", () => {
    expect(isUsableTranscript("")).toBe(false);
    expect(isUsableTranscript("   ")).toBe(false);
    expect(isUsableTranscript(null)).toBe(false);
    expect(isUsableTranscript("успешно записано")).toBe(false);
    expect(isUsableTranscript("Успешно записано.")).toBe(false);
    expect(isUsableTranscript("маяк в тумане")).toBe(true);
  });

  test("voiceResultCopy only toasts success for real speech", () => {
    expect(voiceResultCopy("")).toEqual({ ok: false, error: ASR_EMPTY });
    expect(voiceResultCopy("успешно записано")).toEqual({
      ok: false,
      error: ASR_EMPTY,
    });
    expect(voiceResultCopy("  мысль про маяк  ")).toEqual({
      ok: true,
      text: "мысль про маяк",
      toast: VOICE_RECOGNIZED,
    });
    expect(VOICE_RECOGNIZED).not.toMatch(FAKE_SUCCESS);
  });
});
