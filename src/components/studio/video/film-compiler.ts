/**
 * FilmCompiler (7-b, Фаза C) — настоящий рендер фильма в браузере:
 * canvas-видеоряд (ken-burns, кроссфейды, титры) + WebAudio-микс озвучек
 * → MediaRecorder → WebM Blob. Файл чисто клиентский (Image / AudioContext /
 * MediaRecorder), без React; подключается только из "use client" компонентов.
 */

export interface FilmSceneSource {
  imageUrl: string | null;
  audioUrl: string | null;
  title: string;
  text: string;
}

export type CompilePhase = "load" | "render";

export interface CompileOptions {
  /** 1280 (HD) или 854 (лёгкое). */
  width: number;
  /** 720 или 480. */
  height: number;
  /** Титры сцен (заголовок + 2 строки текста) в начале каждой сцены. */
  showTitles: boolean;
  onProgress?: (phase: CompilePhase, done: number, total: number) => void;
  signal?: AbortSignal;
}
export interface CompileResult {
  blob: Blob;
  durationSec: number;
}

/* ── Константы тайминга ── */
const TEXT_BASE_SEC = 3.5; // сцена без озвучки: минимум столько чтения текста
const TEXT_SEC_PER_CHAR = 0.055; // +сек на символ
const TEXT_MAX_SEC = 18;
const TAIL_SEC = 0.6; // хвост фильма после последней сцены
const TRANSITION_SEC = 0.6; // кроссфейд между сценами
const TITLE_SEC = 3.2; // сколько висят титры сцены
const FADE_SEC = 0.3; // фейд титров
const END_FADE_SEC = 0.5; // общий фейд-в-чёрный в конце
const ABORT_MESSAGE = "Сборка отменена";

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/* ── Поддержка MediaRecorder ── */
const MIME_CANDIDATES: readonly string[] = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

/** Первый поддерживаемый webm-кодек или null. */
export function pickVideoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* некоторые браузеры кидают на незнакомых кодеках */
    }
  }
  return null;
}

/** Можно ли собирать фильм в этом браузере. */
export function filmRenderSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" && pickVideoMime() !== null
  );
}

/* ── Тайминги сцен ── */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sceneDuration(text: string, audioDur: number): number {
  const readSec = clamp(
    TEXT_BASE_SEC + text.length * TEXT_SEC_PER_CHAR,
    TEXT_BASE_SEC,
    TEXT_MAX_SEC,
  );
  return Math.max(audioDur, readSec) + (audioDur > 0 ? 0.4 : 0.2);
}

/* ── Фаза "load": картинки + декод озвучек ── */
interface LoadedScene {
  image: HTMLImageElement | null;
  audio: AudioBuffer | null;
  dur: number;
  title: string;
  text: string;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error(ABORT_MESSAGE);
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  try {
    await img.decode();
    return img.naturalWidth > 0 ? img : null;
  } catch {
    return null;
  }
}

async function loadAudio(
  url: string,
  decodeCtx: AudioContext,
): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await decodeCtx.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadScenes(
  scenes: FilmSceneSource[],
  onProgress: CompileOptions["onProgress"],
  signal?: AbortSignal,
): Promise<LoadedScene[]> {
  const decodeCtx = new AudioContext();
  const loaded: LoadedScene[] = [];
  try {
    for (let i = 0; i < scenes.length; i += 1) {
      throwIfAborted(signal);
      const source = scenes[i];
      if (!source) continue;
      const image = source.imageUrl
        ? await loadImage(source.imageUrl)
        : null;
      const audio = source.audioUrl
        ? await loadAudio(source.audioUrl, decodeCtx)
        : null;
      loaded.push({
        image,
        audio,
        dur: sceneDuration(source.text, audio?.duration ?? 0),
        title: source.title,
        text: source.text,
      });
      onProgress?.("load", i + 1, scenes.length);
    }
  } finally {
    void decodeCtx.close().catch(() => undefined);
  }
  return loaded;
}

/* ── Отрисовка ── */

type Ctx = CanvasRenderingContext2D;

/** Перенос текста по ширине; максимум maxLines, хвост — многоточие. */
function wrapText(ctx: Ctx, text: string, maxWidth: number, maxLines: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || maxLines <= 0) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length > 0 && lines.join(" ") !== clean) {
    let ellipsis = `${lines[lines.length - 1] ?? ""}…`;
    while (ellipsis.length > 2 && ctx.measureText(ellipsis).width > maxWidth) {
      ellipsis = `${ellipsis.slice(0, -2)}…`;
    }
    lines[lines.length - 1] = ellipsis;
  }
  return lines;
}

/** Ken-burns: cover-вписать кадр с zoom 1.03 → 1.09 и диагональным сдвигом. */
function drawKenBurns(ctx: Ctx, img: HTMLImageElement, w: number, h: number, progress: number): void {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  const cover = Math.max(w / iw, h / ih) * (1.03 + 0.06 * progress);
  const dw = iw * cover;
  const dh = ih * cover;
  const dx = (w - dw) / 2 + ((dw - w) / 2) * 0.45 * progress;
  const dy = (h - dh) / 2 + ((dh - h) / 2) * 0.45 * progress;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/** Сцена без кадра: градиент stone + крупный номер + до 6 строк текста. */
function drawPlaceholder(ctx: Ctx, scene: LoadedScene, index: number, w: number, h: number, scale: number): void {
  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#1c1917");
  gradient.addColorStop(1, "#0c0a09");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  const numberSize = Math.round(120 * scale);
  ctx.fillStyle = "#57534e";
  ctx.font = `700 ${numberSize}px ${FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.fillText(String(index + 1).padStart(2, "0"), w / 2, h * 0.42);

  const textSize = Math.round(28 * scale);
  ctx.font = `400 ${textSize}px ${FONT_STACK}`;
  ctx.fillStyle = "#a8a29e";
  const lines = wrapText(ctx, scene.text, w * 0.78, 6);
  const lineHeight = textSize * 1.5;
  const top = h * 0.42 + numberSize * 0.42;
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, top + lineHeight * (i + 1));
  });
  ctx.textAlign = "left";
}

/** Титры: нижний градиент, emerald-полоска, заголовок + 2 строки текста. */
function drawTitles(ctx: Ctx, scene: LoadedScene, w: number, h: number, scale: number, localSec: number): void {
  if (localSec >= TITLE_SEC) return;
  const alpha = Math.min(1, localSec / FADE_SEC, (TITLE_SEC - localSec) / FADE_SEC);
  if (alpha <= 0) return;

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = alpha;
  const overlayH = h * 0.38;
  const gradient = ctx.createLinearGradient(0, h - overlayH, 0, h);
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, h - overlayH, w, overlayH);

  const titleSize = Math.round((w >= 1280 ? 48 : 44) * scale);
  const textSize = Math.round(26 * scale);
  const barWidth = Math.max(2, Math.round(4 * scale));
  const padX = w * 0.06;
  const textX = padX + barWidth + 14 * scale;

  ctx.font = `400 ${textSize}px ${FONT_STACK}`;
  const lines = wrapText(ctx, scene.text, w - textX - padX, 2);
  const lineHeight = textSize * 1.35;
  const titleBase = h - h * 0.075 - lines.length * lineHeight - 8 * scale;

  ctx.fillStyle = "#10b981";
  ctx.fillRect(padX, titleBase - titleSize * 0.72, barWidth, titleSize * 0.92);
  ctx.fillStyle = "#fafaf9";
  ctx.font = `700 ${titleSize}px ${FONT_STACK}`;
  ctx.fillText(scene.title, textX, titleBase);
  ctx.fillStyle = "#d6d3d1";
  ctx.font = `400 ${textSize}px ${FONT_STACK}`;
  lines.forEach((line, i) => {
    ctx.fillText(
      line,
      textX,
      titleBase + titleSize * 0.42 + 12 * scale + lineHeight * (i + 1),
    );
  });
  ctx.globalAlpha = prevAlpha;
}

/** Один кадр фильма на момент t (сек); возвращает индекс текущей сцены. */
function drawFrame(
  ctx: Ctx,
  scenes: LoadedScene[],
  starts: number[],
  totalDur: number,
  w: number,
  h: number,
  t: number,
  showTitles: boolean,
): number {
  ctx.fillStyle = "#0c0a09";
  ctx.fillRect(0, 0, w, h);

  const scale = h / 720;
  let index = scenes.length - 1;
  for (let i = 0; i < scenes.length; i += 1) {
    if (t < starts[i]! + scenes[i]!.dur) {
      index = i;
      break;
    }
  }
  const scene = scenes[index]!;
  const local = t - starts[index]!;
  const progress = clamp(local / scene.dur, 0, 1);

  const drawBody = (target: LoadedScene, i: number, p: number) => {
    if (target.image) drawKenBurns(ctx, target.image, w, h, p);
    else drawPlaceholder(ctx, target, i, w, h, scale);
  };

  if (local < TRANSITION_SEC) {
    /* кроссфейд: предыдущая сцена на её финальном ken-burns снизу */
    if (index > 0) drawBody(scenes[index - 1]!, index - 1, 1);
    ctx.globalAlpha = local / TRANSITION_SEC;
    drawBody(scene, index, progress);
    ctx.globalAlpha = 1;
  } else {
    drawBody(scene, index, progress);
  }

  if (showTitles) drawTitles(ctx, scene, w, h, scale, local);

  /* общий фейд в чёрный на последних 0.5 с */
  const fadeFrom = totalDur - END_FADE_SEC;
  if (t > fadeFrom) {
    ctx.fillStyle = `rgba(0,0,0,${clamp((t - fadeFrom) / END_FADE_SEC, 0, 1)})`;
    ctx.fillRect(0, 0, w, h);
  }
  return index;
}

/* ── Сборка ── */
export async function compileFilm(
  scenes: FilmSceneSource[],
  opts: CompileOptions,
): Promise<CompileResult> {
  if (scenes.length === 0) throw new Error("Нет сцен для сборки фильма");
  const mime = pickVideoMime();
  if (!mime) throw new Error("Браузер не поддерживает запись видео");
  throwIfAborted(opts.signal);

  const { width, height, showTitles, signal, onProgress } = opts;
  const loaded = await loadScenes(scenes, onProgress, signal);
  console.info("[film] loaded", loaded.length, "scenes");

  /* раскладка таймлайна */
  const starts: number[] = [];
  let totalDur = TAIL_SEC;
  for (const scene of loaded) {
    starts.push(totalDur - TAIL_SEC);
    totalDur += scene.dur;
  }
  console.info("[film] timeline totalDur=", totalDur, "starts=", starts.join(","));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось создать холст фильма");

  const canvasStream = canvas.captureStream(30);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const sources: AudioBufferSourceNode[] = [];
  let recorder: MediaRecorder | null = null;
  const cleanup = () => {
    canvasStream.getTracks().forEach((track) => track.stop());
    sources.forEach((node) => {
      try { node.stop(); } catch { /* уже остановлен */ }
    });
    void audioCtx.close().catch(() => undefined);
  };

  try {
    await audioCtx.resume().catch(() => undefined);

    recorder = new MediaRecorder(
      new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]),
      { mimeType: mime },
    );
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve();
    });

    recorder.start(250);
    console.info("[film] recorder started", mime);

    /* расписание озвучек: тихий микс в MediaStreamDestination (не в колонки) */
    const audioBase = audioCtx.currentTime + 0.05;
    loaded.forEach((scene, i) => {
      if (!scene.audio) return;
      const node = audioCtx.createBufferSource();
      node.buffer = scene.audio;
      node.connect(dest);
      node.start(audioBase + starts[i]!);
      sources.push(node);
    });

    /* видеоряд: rAF по wall-clock; прогресс — индекс текущей сцены */
    await new Promise<void>((resolve, reject) => {
      const startedAt = performance.now();
      let lastReported = -1;
      const tick = () => {
        if (signal?.aborted) {
          reject(new Error(ABORT_MESSAGE));
          return;
        }
        const t = (performance.now() - startedAt) / 1000;
        const index = drawFrame(
          ctx,
          loaded,
          starts,
          totalDur,
          width,
          height,
          Math.min(t, totalDur - 0.001),
          showTitles,
        );
        if (index !== lastReported) {
          lastReported = index;
          onProgress?.("render", index, loaded.length);
        }
        if (t >= totalDur) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    throwIfAborted(signal);

    console.info("[film] render done, stopping recorder");
    recorder.stop();
    await stopped;
    console.info("[film] blob ready", new Blob(chunks).size);
    if (signal?.aborted) throw new Error(ABORT_MESSAGE);
    return { blob: new Blob(chunks, { type: mime }), durationSec: totalDur };
  } catch (err) {
    /* отмена/ошибка: остановить запись лучшим случаем (чанки не нужны) */
    if (recorder && recorder.state !== "inactive") recorder.stop();
    throw err;
  } finally {
    cleanup();
  }
}
