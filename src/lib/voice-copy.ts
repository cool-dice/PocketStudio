/**
 * Honest voice-capture copy. Failed ASR / denied mic is never «успешно записано».
 */

import { MAX_NOTE_LENGTH } from "@/lib/types";

/** Stub the old z-ai SDK used to persist instead of a real transcript. */
const FAKE_SUCCESS_RE = /^успешно записано\.?$/i;

export const MIC_PERMISSION_DENIED = "Доступ к микрофону запрещён";
export const MIC_NOT_FOUND = "Микрофон не найден";
export const MIC_UNSUPPORTED_BROWSER =
  "Запись голоса не поддерживается в этом браузере";
export const MIC_UNSUPPORTED_AUDIO = "Браузер не поддерживает запись аудио";
export const MIC_START_FAILED = "Не удалось начать запись";
export const RECORDING_INACTIVE = "Запись не активна";
export const RECORDING_TOO_SHORT =
  "Запись слишком короткая — попробуйте ещё раз";
export const RECORDING_PROCESS_FAILED =
  "Не удалось обработать запись — попробуйте ещё раз";

export const ASR_EMPTY =
  "Не удалось распознать речь — попробуйте записать ещё раз";
export const ASR_UNAVAILABLE =
  "Сервис распознавания недоступен, попробуйте позже";
export const ASR_GENERIC = "Не удалось распознать голос";
export const VOICE_RECOGNIZED = "Голос распознан — проверьте текст";
export const VOICE_REVIEW_AND_SAVE =
  "Голос распознан — проверьте и сохраните";

export function isUsableTranscript(text: string | null | undefined): boolean {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return false;
  return !FAKE_SUCCESS_RE.test(trimmed);
}

export function voiceResultCopy(
  transcript: string | null | undefined,
):
  | { ok: true; text: string; toast: typeof VOICE_RECOGNIZED }
  | { ok: false; error: typeof ASR_EMPTY } {
  const text = (transcript ?? "").trim();
  if (!isUsableTranscript(text)) {
    return { ok: false, error: ASR_EMPTY };
  }
  return { ok: true, text, toast: VOICE_RECOGNIZED };
}

export function voiceReviewCopy(
  transcript: string | null | undefined,
):
  | { ok: true; text: string; toast: typeof VOICE_REVIEW_AND_SAVE }
  | { ok: false; error: typeof ASR_EMPTY } {
  const result = voiceResultCopy(transcript);
  if (!result.ok) return result;
  return { ok: true, text: result.text, toast: VOICE_REVIEW_AND_SAVE };
}

/** True when this exact draft was already POSTed as a note in this session. */
export function isTranscriptAlreadySaved(
  trimmed: string,
  savedText: string | null | undefined,
): boolean {
  return Boolean(savedText) && trimmed === savedText;
}

/**
 * Show the «Расшифровка» block only when a real ASR string exists and
 * the user (or later edit) changed rawText away from it.
 */
export function shouldShowTranscription(
  rawText: string | null | undefined,
  transcription: string | null | undefined,
): boolean {
  const asr = (transcription ?? "").trim();
  if (!isUsableTranscript(asr)) return false;
  return asr !== (rawText ?? "").trim();
}

/**
 * Original ASR text to store beside rawText. Empty / stub «успешно записано»
 * → null so typed notes stay without a transcription.
 */
export function persistableTranscription(
  transcript: string | null | undefined,
): string | null {
  const text = (transcript ?? "").trim();
  if (!isUsableTranscript(text)) return null;
  return text.slice(0, MAX_NOTE_LENGTH);
}
