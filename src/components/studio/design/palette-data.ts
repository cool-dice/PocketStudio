/**
 * Данные дизайн-модуля (Фаза A) — клиентский слой:
 * мудборд референсов (плитки = артефакты image/portrait воркспейса,
 * stage "design" = «в мудборде») + пресеты генерации кадра и быстрые
 * брифы для палитры стиля. Плитки переиспользуют домен галереи
 * изображений (../images/gallery-data).
 */

import type { ArtifactDto } from "@/lib/workspace-types";
import {
  IMAGE_SIZE_PRESETS,
  pendingTile,
  tileFromArtifact,
  type GalleryTile,
  type ImageAspect,
} from "../images/gallery-data";

export { formatTileDate as formatBoardDate } from "../images/gallery-data";

/* ─────────────────────────── пресеты кадров ─────────────────────────── */

/** Три пресета для кадров мудборда (квадрат / альбомная / широкая). */
export const BOARD_SIZE_PRESETS = IMAGE_SIZE_PRESETS.filter((p) =>
  ["1024x1024", "1152x864", "1440x720"].includes(p.id),
);

export function boardPresetById(id: string) {
  return BOARD_SIZE_PRESETS.find((p) => p.id === id) ?? BOARD_SIZE_PRESETS[0];
}

/** Запрос на генерацию кадра из панели мудборда. */
export interface FrameRequest {
  prompt: string;
  size: string;
}

/* ─────────────────────────── быстрые идеи ─────────────────────────── */

export const SAMPLE_FRAME_PROMPTS = [
  {
    label: "Кадр-настроение",
    prompt:
      "Кадр-настроение: рассвет над портовым городком, лёгкий туман, тёплый свет фонарей, кинематографичный реализм, приглушённые тона",
  },
  {
    label: "Референс локации",
    prompt:
      "Интерьер старой библиотеки: высокие стеллажи до потолка, пыльный свет из арочного окна, тёплое дерево, живописная детализация",
  },
  {
    label: "Текстура",
    prompt:
      "Абстрактная текстура фона: мокрый камень и мох, приглушённые зелёные и серые тона, макросъёмка, мягкий рассеянный свет",
  },
] as const;

export const SAMPLE_BRIEFS = [
  {
    label: "Кинотриллер",
    brief: "Кинематографичный триллер: холодные тени, ледяная гамма с одним тёплым акцентом, тревожная тишина",
  },
  {
    label: "Северная сказка",
    brief: "Тёплая уютная история для всей семьи: мягкий свет, натуральные материалы, северная природа",
  },
  {
    label: "Аудио-журнал",
    brief: "Минимализм редакции: много воздуха, чёрно-белая база, один смелый акцентный цвет",
  },
] as const;

/* ─────────────────────────── плитки мудборда ─────────────────────────── */

/** Плитка «в мудборде», если у артефакта stage === "design". */
export function isBoardTile(tile: GalleryTile): boolean {
  return tile.stage === "design";
}

/** Артефакт → плитка мудборда (image/portrait). */
export function boardTileFromArtifact(artifact: ArtifactDto): GalleryTile {
  return tileFromArtifact(artifact);
}

/** Плитка-заглушка «студия рисует кадр» — сразу как «в мудборде». */
export function pendingBoardTile(
  prompt: string,
  aspect: ImageAspect,
  sizeLabel: string,
): GalleryTile {
  return { ...pendingTile(prompt, aspect, sizeLabel), stage: "design" };
}

/** Русская плюрализация кадров: 1 кадр / 2 кадра / 5 кадров. */
export function pluralFrames(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} кадр`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
    return `${n} кадра`;
  return `${n} кадров`;
}
