/**
 * Доменный слой галереи изображений (Фаза A, A2-c) — живые данные.
 * Артефакты приходят из REST (ArtifactDto): у сгенерированных есть url
 * (реальный PNG в /gen/...), у сид-концептов — градиент в meta.gradient.
 * Здесь: маппинг DTO → плитка галереи, пресеты размеров генерации,
 * вывод пропорций и утилиты отображения.
 */

import type { ArtifactDto } from "@/lib/workspace-types";

/* ─────────────────────────── размеры генерации ─────────────────────────── */

export type ImageAspect = "square" | "landscape" | "portrait" | "wide" | "tall";

export interface ImageSizePreset {
  /** Значение для POST /api/ai/image. */
  id: string;
  /** Русская подпись пресета. */
  label: string;
  /** Разрешение для подписей UI. */
  size: string;
  aspect: ImageAspect;
}

export const IMAGE_SIZE_PRESETS: ImageSizePreset[] = [
  { id: "1024x1024", label: "Квадрат", size: "1024×1024", aspect: "square" },
  { id: "1152x864", label: "Альбомная", size: "1152×864", aspect: "landscape" },
  { id: "864x1152", label: "Книжная", size: "864×1152", aspect: "portrait" },
  { id: "1440x720", label: "Широкая", size: "1440×720", aspect: "wide" },
  { id: "720x1440", label: "Вертикальная", size: "720×1440", aspect: "tall" },
];

export function presetById(id: string): ImageSizePreset {
  return IMAGE_SIZE_PRESETS.find((p) => p.id === id) ?? IMAGE_SIZE_PRESETS[0];
}

export function aspectClass(aspect: ImageAspect): string {
  switch (aspect) {
    case "square":
      return "aspect-square";
    case "landscape":
      return "aspect-[4/3]";
    case "portrait":
      return "aspect-[3/4]";
    case "wide":
      return "aspect-[2/1]";
    case "tall":
      return "aspect-[1/2]";
  }
}

/** Ближайший пресет пропорций к произвольному w×h. */
function ratioToAspect(w: number, h: number): ImageAspect {
  const r = w / h;
  if (r >= 1.8) return "wide";
  if (r >= 1.15) return "landscape";
  if (r <= 0.55) return "tall";
  if (r <= 0.87) return "portrait";
  return "square";
}

/**
 * Пропорции существующего артефакта: у сид-концептов разрешение иногда
 * зашито в meta.meta («1024×576 · зимний перевал»); иначе — квадрат.
 */
function inferAspect(artifact: ArtifactDto): ImageAspect {
  const meta = (artifact.meta ?? {}) as Record<string, unknown>;
  const raw =
    typeof meta.size === "string"
      ? meta.size
      : typeof meta.meta === "string"
        ? meta.meta
        : "";
  const m = /(\d{3,4})\s?[×x*]\s?(\d{3,4})/.exec(raw);
  if (m) return ratioToAspect(Number(m[1]), Number(m[2]));
  return "square";
}

/* ─────────────────────────── быстрые идеи ─────────────────────────── */

export const SAMPLE_PROMPTS = [
  {
    label: "Обложка книги",
    prompt:
      "Обложка романа: одинокий маяк на скале, северное море в сумерках, спокойные холодные тона, живописная иллюстрация",
  },
  {
    label: "Портрет героя",
    prompt:
      "Портрет героя истории: тёплый свет камина на лице, внимательный взгляд, живописная манера, мягкий фон",
  },
  {
    label: "Раскадровка сцены",
    prompt:
      "Кинематографичный кадр: герой на заснеженном перевале, рассветный свет, широкий план, формат раскадровки",
  },
  {
    label: "Обложка подкаста",
    prompt:
      "Минималистичная обложка подкаста: ламповый свет, кружка чая и наушники, тёплые тона, плоская иллюстрация",
  },
] as const;

/* ─────────────────────────── плитка галереи ─────────────────────────── */

export type GalleryTileStatus = "ready" | "generating";

export interface GalleryTile {
  id: string;
  /** Тип артефакта из БД (у галереи — image или portrait). */
  kind: "image" | "portrait";
  title: string;
  prompt: string;
  description: string | null;
  /** Реальный файл (/gen/<uuid>.png) — рендерится <img>. */
  url: string | null;
  /** CSS-градиент («linear-gradient(...)») или tailwind-классы заглушки. */
  gradient: string | null;
  aspect: ImageAspect;
  sizeLabel: string;
  stage: string | null;
  favorite: boolean;
  /** ISO-дата создания. */
  createdAt: string;
  status: GalleryTileStatus;
}

/** Квадратная заглушка по умолчанию для артефактов без градиента. */
export const FALLBACK_GRADIENT =
  "linear-gradient(140deg, #44403c 0%, #292524 55%, #1c1917 100%)";

/** DTO артефакта → плитка галереи. */
export function tileFromArtifact(
  artifact: ArtifactDto,
  knownAspect?: ImageAspect,
): GalleryTile {
  const meta = (artifact.meta ?? {}) as Record<string, unknown>;
  const gradient =
    typeof meta.gradient === "string" && meta.gradient.trim() !== ""
      ? meta.gradient
      : null;
  const aspect = knownAspect ?? inferAspect(artifact);
  const preset =
    IMAGE_SIZE_PRESETS.find((p) => p.aspect === aspect) ?? IMAGE_SIZE_PRESETS[0];
  return {
    id: artifact.id,
    kind: artifact.type === "portrait" ? "portrait" : "image",
    title: artifact.title,
    prompt: artifact.prompt ?? artifact.title,
    description: artifact.description,
    url: artifact.url,
    gradient,
    aspect,
    sizeLabel: preset.size,
    stage: artifact.stage,
    favorite: artifact.favorite,
    createdAt: artifact.createdAt,
    status: "ready",
  };
}

/** Плитка-заглушка «генерация идёт» — встаёт в верх галереи. */
export function pendingTile(
  prompt: string,
  aspect: ImageAspect,
  sizeLabel: string,
): GalleryTile {
  return {
    id: `pending-${Date.now()}`,
    kind: "image",
    title: prompt.trim().slice(0, 80) || "Изображение по описанию студии",
    prompt: prompt.trim() || "Изображение по описанию студии",
    description: null,
    url: null,
    gradient: FALLBACK_GRADIENT,
    aspect,
    sizeLabel,
    stage: null,
    favorite: false,
    createdAt: new Date().toISOString(),
    status: "generating",
  };
}

/* ─────────────────────────── утилиты отображения ─────────────────────────── */

/** Точечная сетка поверх градиента — «текстура» превью-заглушек. */
export const DOT_PATTERN_STYLE = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px)",
  backgroundSize: "13px 13px",
} as const;

/** «18 сентября, 10:18». */
export function formatTileDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Русская плюрализация: 1 изображение / 2 изображения / 5 изображений. */
export function pluralImages(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} изображение`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} изображения`;
  return `${n} изображений`;
}
