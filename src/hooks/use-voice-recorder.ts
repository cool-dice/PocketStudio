"use client";

/**
 * useVoiceRecorder — voice capture engine for PocketStudio (Stage 2, Task 6-b).
 *
 * State machine: idle → requesting → recording → processing → idle.
 *  - idle       — nothing captured, mic button available.
 *  - requesting — waiting for the getUserMedia permission prompt.
 *  - recording  — MediaRecorder active (250 ms timeslices) + live level meter.
 *  - processing — recorder stopped, converting to WAV / caller is uploading.
 *
 * stop() converts the captured Blob into a 16 kHz mono PCM16 WAV (44-byte
 * header) and returns it base64-encoded — the format the backend ASR accepts
 * reliably (raw webm/opus is not guaranteed). The machine stays in
 * "processing" after a successful stop() until the caller invokes reset()
 * (success or error) so the UI can show "Распознаём…" during the whole
 * upload round-trip.
 *
 * React correctness: all mutable recording resources live in refs (recorder,
 * chunks, stream, AudioContexts, timers) so start/stop/reset are stable
 * callbacks without stale closures; the hook survives StrictMode double-mount
 * and cleans everything up on unmount / cancel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MIC_NOT_FOUND,
  MIC_PERMISSION_DENIED,
  MIC_START_FAILED,
  MIC_UNSUPPORTED_AUDIO,
  MIC_UNSUPPORTED_BROWSER,
  RECORDING_INACTIVE,
  RECORDING_PROCESS_FAILED,
  RECORDING_TOO_SHORT,
} from "@/lib/voice-copy";

export type VoiceRecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "processing";

/** Converted recording ready for POST /api/notes/voice. */
export interface VoiceClip {
  /** 16 kHz mono PCM16 WAV as standard base64 (no data: prefix). */
  audioBase64: string;
  mime: string;
  durationMs: number;
}

export const MAX_RECORDING_MS = 90_000;
export const TARGET_SAMPLE_RATE = 16_000;

/** Preference order — the first type the browser supports wins. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

/** Multiplier weights for the decorative level bars. */
export const LEVEL_BAR_FACTORS = [0.45, 0.72, 1, 0.78, 0.5] as const;

/** "0:07" / "1:30" — capped at the 90 s auto-stop limit. */
export function formatRecordingTime(ms: number): string {
  const total = Math.min(
    Math.ceil(MAX_RECORDING_MS / 1000),
    Math.max(0, Math.floor(ms / 1000)),
  );
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/** User-facing error thrown/reported by the engine (Russian UI). */
class VoiceCaptureError extends Error {}

function isRecorderSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      // Some browsers throw on unknown codecs — try the next candidate.
    }
  }
  return null;
}

/* ── Audio conversion: Blob → 16 kHz mono WAV PCM16 → base64 ── */

/** Average all channels into one Float32 mono track. */
function mixDownToMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const out = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) out[i] += data[i] / channels;
  }
  return out;
}

/** Linear-interpolation resampling (speech-quality is fine for ASR). */
function resampleLinear(
  input: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || input.length === 0) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = pos - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

/** Standard RIFF/WAVE PCM16 mono encoder with a 44-byte header. */
function encodeWavPcm16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true); // rest-of-file size
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // avoid argument-length limits
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Convert a recorded Blob (webm/opus, mp4, ogg…) into base64 WAV:
 * decodeAudioData → mono mixdown → resample to 16 kHz → PCM16 WAV.
 */
async function blobToWav16kMonoBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const decodeCtx = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await decodeCtx.decodeAudioData(arrayBuffer);
  } catch {
    throw new VoiceCaptureError(RECORDING_PROCESS_FAILED);
  } finally {
    void decodeCtx.close().catch(() => undefined);
  }

  if (audioBuffer.duration < 0.25 || audioBuffer.length === 0) {
    throw new VoiceCaptureError(RECORDING_TOO_SHORT);
  }

  const mono = mixDownToMono(audioBuffer);
  const resampled = resampleLinear(
    mono,
    audioBuffer.sampleRate,
    TARGET_SAMPLE_RATE,
  );
  return arrayBufferToBase64(encodeWavPcm16(resampled, TARGET_SAMPLE_RATE));
}

/* ── The hook ── */

export function useVoiceRecorder(options?: {
  /** Fires when the 90 s auto-stop kicks in — run your upload flow here. */
  onAutoStop?: (clip: VoiceClip) => void;
}) {
  const [state, setState] = useState<VoiceRecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  const stateRef = useRef<VoiceRecorderState>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const stopInFlightRef = useRef<Promise<VoiceClip> | null>(null);
  const onAutoStopRef = useRef(options?.onAutoStop);
  // False once the owning component unmounts — guards the window where the
  // permission prompt is open and getUserMedia resolves AFTER unmount
  // (without this, the timer/raf/AudioContext/mic stream would leak on a
  // dead instance).
  const aliveRef = useRef(true);

  const applyState = useCallback((next: VoiceRecorderState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  // SSR-safe capability probe (post-mount so hydration never mismatches).
  useEffect(() => {
    setSupported(isRecorderSupported());
  }, []);

  // Keep the auto-stop callback fresh without stale closures.
  useEffect(() => {
    onAutoStopRef.current = options?.onAutoStop;
  });

  const stopVisualizer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    const ctx = analyserCtxRef.current;
    analyserCtxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      void ctx.close().catch(() => undefined);
    }
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Full resource teardown — idempotent, safe from any state. */
  const teardown = useCallback(() => {
    stopTimer();
    stopVisualizer();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Recorder already gone — nothing to release.
        }
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    chunksRef.current = [];
    setLevel(0);
  }, [stopTimer, stopVisualizer]);

  const startVisualizer = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser); // not connected to destination → no feedback
      analyserCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.fftSize);
      let lastTick = 0;
      const loop = () => {
        rafRef.current = requestAnimationFrame(loop);
        const node = analyserRef.current;
        if (!node) return;
        const now = performance.now();
        if (now - lastTick < 90) return; // throttle re-renders
        lastTick = now;
        node.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 3.5));
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch {
      // The level meter is decorative — recording works without it.
    }
  }, []);

  /** Real stop implementation — see stop() for the in-flight dedupe. */
  const doStop = useCallback(async (): Promise<VoiceClip> => {
    const recorder = recorderRef.current;
    if (stateRef.current !== "recording" || !recorder) {
      throw new VoiceCaptureError(RECORDING_INACTIVE);
    }

    const startedAt = startedAtRef.current;
    const durationMs = startedAt ? Date.now() - startedAt : 0;

    applyState("processing");
    stopTimer();
    stopVisualizer();

    try {
      const chunks = chunksRef.current;
      const type = recorder.mimeType || mimeRef.current || "audio/webm";
      let blob: Blob;
      if (recorder.state === "inactive") {
        blob = new Blob(chunks, { type });
      } else {
        blob = await new Promise<Blob>((resolve, reject) => {
          const onStop = () => resolve(new Blob(chunks, { type }));
          recorder.addEventListener("stop", onStop, { once: true });
          try {
            recorder.stop();
          } catch (err) {
            recorder.removeEventListener("stop", onStop);
            reject(err);
          }
        });
      }
      teardown(); // release tracks + analyser context

      if (blob.size === 0) {
        throw new VoiceCaptureError(RECORDING_TOO_SHORT);
      }
      const audioBase64 = await blobToWav16kMonoBase64(blob);
      return { audioBase64, mime: "audio/wav", durationMs };
    } catch (err) {
      teardown();
      applyState("idle");
      setElapsedMs(0);
      const message =
        err instanceof VoiceCaptureError
          ? err.message
          : RECORDING_PROCESS_FAILED;
      setError(message);
      throw new VoiceCaptureError(message);
    }
  }, [applyState, stopTimer, stopVisualizer, teardown]);

  /** Public stop: concurrent calls share one in-flight promise. */
  const stop = useCallback((): Promise<VoiceClip> => {
    if (stopInFlightRef.current) return stopInFlightRef.current;
    const promise = doStop().finally(() => {
      stopInFlightRef.current = null;
    });
    stopInFlightRef.current = promise;
    return promise;
  }, [doStop]);

  // The auto-stop timer needs stop() before start() is defined — via ref.
  const stopRef = useRef(stop);
  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const start = useCallback(async () => {
    if (stateRef.current !== "idle") return;
    setError(null);
    setElapsedMs(0);
    setLevel(0);

    if (!isRecorderSupported()) {
      const message = MIC_UNSUPPORTED_BROWSER;
      setError(message);
      throw new VoiceCaptureError(message);
    }
    const mime = pickMimeType();
    if (!mime) {
      const message = MIC_UNSUPPORTED_AUDIO;
      setError(message);
      throw new VoiceCaptureError(message);
    }

    applyState("requesting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err) {
      applyState("idle");
      const name = err instanceof DOMException ? err.name : "";
      const message =
        name === "NotAllowedError" ||
        name === "SecurityError" ||
        name === "PermissionDeniedError"
          ? MIC_PERMISSION_DENIED
          : name === "NotFoundError" || name === "DevicesNotFoundError"
            ? MIC_NOT_FOUND
            : MIC_START_FAILED;
      setError(message);
      throw new VoiceCaptureError(message);
    }

    // The hook may have been reset or unmounted while the permission prompt
    // was open — never start recording on a dead/aborted session.
    if (
      (stateRef.current as VoiceRecorderState) !== "requesting" ||
      !aliveRef.current
    ) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      applyState("idle");
      const message = MIC_START_FAILED;
      setError(message);
      throw new VoiceCaptureError(message);
    }

    mimeRef.current = mime;
    streamRef.current = stream;
    chunksRef.current = [];
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    startVisualizer(stream);
    recorder.start(250); // frequent timeslices → chunked, resumable data
    applyState("recording");

    timerRef.current = window.setInterval(() => {
      const startedAt = startedAtRef.current;
      if (!startedAt || stateRef.current !== "recording") return;
      const ms = Date.now() - startedAt;
      setElapsedMs(ms);
      if (ms >= MAX_RECORDING_MS) {
        stopTimer();
        // Same flow as a manual stop — hand the clip to the owner.
        void stopRef
          .current()
          .then((clip) => onAutoStopRef.current?.(clip))
          .catch(() => {
            // stop() already surfaced the error via state.
          });
      }
    }, 200);
  }, [applyState, startVisualizer, stopTimer]);

  /** Discard everything and return to idle (shared by cancel/reset). */
  const toIdle = useCallback(() => {
    teardown();
    stopInFlightRef.current = null;
    applyState("idle");
    setError(null);
    setElapsedMs(0);
  }, [applyState, teardown]);

  /** Abort the recording and throw the audio away. */
  const cancel = useCallback(() => {
    toIdle();
  }, [toIdle]);

  /**
   * Return to idle after stop() — call when the upload/ASR round-trip
   * finishes (success or error); resets the "Распознаём…" state.
   */
  const reset = useCallback(() => {
    toIdle();
  }, [toIdle]);

  // Hard cleanup on unmount (dialog closed mid-recording etc.). StrictMode
  // double-mount safe: aliveRef flips false→true→… and stays true on the
  // final live mount.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      teardown();
    };
  }, [teardown]);

  return {
    state,
    elapsedMs,
    level,
    error,
    supported,
    start,
    stop,
    cancel,
    reset,
  };
}
