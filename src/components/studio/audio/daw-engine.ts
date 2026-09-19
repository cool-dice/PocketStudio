/**
 * daw-engine — карманный движок DAW на Web Audio API (Фаза C).
 * Один код синтеза для live (AudioContext + lookahead-планировщик с
 * подсветкой шага) и offline (OfflineAudioContext → WAV 16-bit PCM).
 * Все триггеры принимают (ctx: BaseAudioContext, out: AudioNode, time) и
 * сами останавливают свои источники — никаких висящих нод.
 */

import {
  DRUM_INSTRUMENTS,
  midiToFreq,
  stepCount,
  stepSeconds,
  type DawState,
  type DrumInstrument,
  type SynthKind,
  type Waveform,
} from "@/lib/daw-model";

/* ───────────────────── Общий граф ───────────────────── */

/** Мастер-шина + входная шина каждой дорожки (volume·mute учтён). */
interface DawGraph {
  ctx: BaseAudioContext;
  master: GainNode;
  tracks: Map<string, GainNode>;
}

function buildGraph(ctx: BaseAudioContext, state: DawState): DawGraph {
  const master = ctx.createGain();
  master.gain.value = state.masterVolume;
  master.connect(ctx.destination);
  const tracks = new Map<string, GainNode>();
  for (const track of state.tracks) {
    const bus = ctx.createGain();
    bus.gain.value = track.muted ? 0 : track.volume;
    const panner = ctx.createStereoPanner();
    panner.pan.value = track.pan;
    bus.connect(panner);
    panner.connect(master);
    tracks.set(track.id, bus);
  }
  return { ctx, master, tracks };
}

/* ───────────────────── Шумовой буфер ───────────────────── */

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** 2 секунды белого шума (один буфер на контекст — для снейра/хэта/хлопка). */
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const length = Math.floor(ctx.sampleRate * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  noiseCache.set(ctx, buffer);
  return buffer;
}

/* ───────────────────── Триггеры барабанов ───────────────────── */

function triggerKick(ctx: BaseAudioContext, out: AudioNode, time: number): void {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(160, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.09);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
  osc.connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.32);
}

function triggerSnare(ctx: BaseAudioContext, out: AudioNode, time: number): void {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  gain.connect(out);

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx);
  noise.playbackRate.value = 1;
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1800;
  noise.connect(bandpass).connect(gain);

  const body = ctx.createOscillator();
  body.type = "triangle";
  body.frequency.value = 200;
  body.connect(gain);

  noise.start(time);
  noise.stop(time + 0.22);
  body.start(time);
  body.stop(time + 0.22);
}

function triggerHihat(ctx: BaseAudioContext, out: AudioNode, time: number): void {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx);
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 7500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.45, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  noise.connect(highpass).connect(gain).connect(out);
  noise.start(time);
  noise.stop(time + 0.08);
}

function triggerClap(ctx: BaseAudioContext, out: AudioNode, time: number): void {
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx);
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1400;
  bandpass.Q.value = 1.2;
  const gain = ctx.createGain();
  // Три коротких всплеска (0 / 12 / 24 мс) + хвост 0.12 с.
  gain.gain.setValueAtTime(0.55, time);
  gain.gain.exponentialRampToValueAtTime(0.05, time + 0.008);
  gain.gain.setValueAtTime(0.55, time + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.05, time + 0.02);
  gain.gain.setValueAtTime(0.55, time + 0.024);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.024 + 0.12);
  noise.connect(bandpass).connect(gain).connect(out);
  noise.start(time);
  noise.stop(time + 0.024 + 0.16);
}

function triggerTom(ctx: BaseAudioContext, out: AudioNode, time: number): void {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(200, time);
  osc.frequency.exponentialRampToValueAtTime(85, time + 0.2);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.85, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  osc.connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.34);
}

const DRUM_TRIGGERS: Record<
  DrumInstrument,
  (ctx: BaseAudioContext, out: AudioNode, time: number) => void
> = {
  kick: triggerKick,
  snare: triggerSnare,
  hihat: triggerHihat,
  clap: triggerClap,
  tom: triggerTom,
};

/** Один удар барабанного инструмента (общий для live/offline). */
export function triggerDrum(ctx: BaseAudioContext, out: AudioNode, instrument: DrumInstrument, time: number): void {
  DRUM_TRIGGERS[instrument](ctx, out, time);
}

/* ───────────────────── Синт ───────────────────── */

/** Одна нота синт-дорожки (bass/lead/pad) — общий для live/offline. */
export function triggerNote(
  ctx: BaseAudioContext,
  out: AudioNode,
  opts: {
    waveform: Waveform;
    freq: number;
    time: number;
    /** Длительность звучания до релиза (сек). */
    duration: number;
    kind: SynthKind;
  },
): void {
  const { waveform, freq, time, duration, kind } = opts;
  const attack = kind === "pad" ? 0.25 : 0.008;
  const release = kind === "pad" ? 0.35 : 0.12;
  const peak = kind === "bass" ? 0.45 : kind === "lead" ? 0.32 : 0.26;
  const stopAt = time + attack + duration + release + 0.05;

  const osc = ctx.createOscillator();
  osc.type = waveform;
  osc.frequency.value = freq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + attack);
  gain.gain.setValueAtTime(peak, time + attack + duration);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + duration + release);

  let head: AudioNode = osc;
  const lowpassHz = kind === "bass" ? 900 : kind === "pad" ? 2200 : null;
  if (lowpassHz !== null) {
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = lowpassHz;
    osc.connect(lowpass);
    head = lowpass;
  } else {
    // Лид — лёгкое вибрато (LFO 5 Гц, глубина 4 Гц).
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 5;
    const depth = ctx.createGain();
    depth.gain.value = 4;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(time);
    lfo.stop(stopAt);
  }

  head.connect(gain).connect(out);
  osc.start(time);
  osc.stop(stopAt);
}

/* ───────────────────── Голос и метроном ───────────────────── */

/** Воспроизвести декодированный буфер озвучки на шаге клипа. */
export function triggerVoice(
  ctx: BaseAudioContext,
  out: AudioNode,
  buffer: AudioBuffer,
  time: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(out);
  src.start(time);
  src.stop(time + buffer.duration);
}

/** Щелчок метронома: сильная доля (каждые 16 шагов) — 1000 Гц, иначе 800. */
function triggerMetronome(ctx: BaseAudioContext, out: AudioNode, strong: boolean, time: number): void {
  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.value = strong ? 1000 : 800;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
  osc.connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.05);
}

/* ───────────────────── Планировка шага ───────────────────── */

/** Спланировать все звуки одного шага сетки на время time. */
function scheduleStepAt(
  graph: DawGraph,
  state: DawState,
  step: number,
  time: number,
  voiceBuffers: Map<string, AudioBuffer>,
): void {
  if (state.metronome && step % 4 === 0) {
    triggerMetronome(graph.ctx, graph.master, step % 16 === 0, time);
  }
  const stepSec = stepSeconds(state.bpm);
  for (const track of state.tracks) {
    if (track.muted) continue;
    const out = graph.tracks.get(track.id);
    if (!out) continue;
    if (track.kind === "drums") {
      if (track.drums) {
        for (const inst of DRUM_INSTRUMENTS) {
          if (track.drums[inst][step]) triggerDrum(graph.ctx, out, inst, time);
        }
      }
    } else if (track.kind === "voice") {
      const buffer = track.voice ? voiceBuffers.get(track.id) : undefined;
      if (track.voice && buffer && track.voice.step === step) {
        triggerVoice(graph.ctx, out, buffer, time);
      }
    } else if (track.notes) {
      const kind: SynthKind = track.kind;
      const duration = stepSec * (kind === "pad" ? 2 : 1) * 0.95;
      for (const note of track.notes) {
        if (note.step !== step) continue;
        triggerNote(graph.ctx, out, {
          waveform: track.waveform ?? "sawtooth",
          freq: midiToFreq(note.midi + state.transpose),
          time,
          duration,
          kind,
        });
      }
    }
  }
}

/* ───────────────────── Live-движок ───────────────────── */

const LOOKAHEAD_INTERVAL_MS = 25;
const LOOKAHEAD_SEC = 0.12;

export type StepCallback = (step: number) => void;

export interface DawEngine {
  readonly ctx: AudioContext;
  play(state: DawState, voiceBuffers: Map<string, AudioBuffer>, fromStep?: number): void;
  stop(): void;
  onStep(cb: StepCallback): void;
  setMasterVolume(v: number): void;
  isPlaying(): boolean;
}

export function createDawEngine(): DawEngine {
  const ctx = new AudioContext();
  let timer: ReturnType<typeof setInterval> | null = null;
  let stepCb: StepCallback | null = null;
  let graph: DawGraph | null = null;
  let state: DawState | null = null;
  let buffers = new Map<string, AudioBuffer>();
  let nextStepTime = 0;
  let currentStep = 0;
  let totalSteps = 1;
  let playing = false;
  let highlightTimers: ReturnType<typeof setTimeout>[] = [];

  function scheduleHighlight(step: number, time: number): void {
    if (!stepCb) return;
    const cb = stepCb;
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    const id = setTimeout(() => {
      highlightTimers = highlightTimers.filter((t) => t !== id);
      if (playing) cb(step);
    }, delay);
    highlightTimers.push(id);
  }

  function tick(): void {
    if (!playing || !graph || !state) return;
    const horizon = ctx.currentTime + LOOKAHEAD_SEC;
    const stepSec = stepSeconds(state.bpm);
    while (nextStepTime < horizon) {
      const step = currentStep % totalSteps;
      scheduleStepAt(graph, state, step, nextStepTime, buffers);
      scheduleHighlight(step, nextStepTime);
      currentStep = (currentStep + 1) % totalSteps;
      nextStepTime += stepSec;
    }
  }

  return {
    ctx,
    play(nextState, voiceBuffers, fromStep = 0) {
      this.stop();
      void ctx.resume();
      state = nextState;
      buffers = voiceBuffers;
      graph = buildGraph(ctx, nextState);
      totalSteps = Math.max(1, stepCount(nextState.bars));
      currentStep = Math.min(Math.max(0, fromStep), totalSteps - 1);
      nextStepTime = ctx.currentTime + 0.06;
      playing = true;
      tick();
      timer = setInterval(tick, LOOKAHEAD_INTERVAL_MS);
    },
    stop() {
      playing = false;
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
      for (const id of highlightTimers) clearTimeout(id);
      highlightTimers = [];
      if (graph) {
        try {
          graph.master.disconnect();
        } catch {
          /* уже отключён */
        }
        graph = null;
      }
    },
    onStep(cb) {
      stepCb = cb;
    },
    setMasterVolume(v) {
      if (graph) graph.master.gain.setTargetAtTime(v, ctx.currentTime, 0.02);
    },
    isPlaying() {
      return playing;
    },
  };
}

/* ───────────────────── Экспорт микса ───────────────────── */

/** Сборка стерео-WAV (16-bit PCM, 44-байтный заголовок) из AudioBuffer. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels) || 1;
  const frames = buffer.length;
  const blockAlign = channels * 2;
  const dataSize = frames * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataSize));

  const ascii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, dataSize, true);

  const left = buffer.getChannelData(0);
  const right = channels > 1 ? buffer.getChannelData(1) : left;
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i] ?? 0));
    const r = Math.max(-1, Math.min(1, right[i] ?? 0));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(offset + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    offset += 4;
  }
  return new Blob([view.buffer], { type: "audio/wav" });
}

/** Оффлайн-рендер проекта в WAV-блоб (тот же граф и триггеры, что и в live). */
export async function renderDawToWav(
  state: DawState,
  voiceBuffers: Map<string, AudioBuffer>,
): Promise<Blob> {
  const totalSteps = Math.max(1, stepCount(state.bars));
  const stepSec = stepSeconds(state.bpm);
  const sampleRate = 44100;
  const duration = totalSteps * stepSec + 1.5;
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * duration), sampleRate);
  const graph = buildGraph(ctx, state);
  for (let step = 0; step < totalSteps; step++) {
    scheduleStepAt(graph, state, step, step * stepSec, voiceBuffers);
  }
  const rendered = await ctx.startRendering();
  return encodeWav(rendered);
}
