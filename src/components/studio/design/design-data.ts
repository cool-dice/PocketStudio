import type { LucideIcon } from "lucide-react";
import {
  BoxSelect,
  Brush,
  CloudFog,
  Contrast,
  Crop,
  Eraser,
  FileImage,
  Frame,
  Image,
  Monitor,
  Mountain,
  Move,
  Pipette,
  Plus,
  Shapes,
  SunMedium,
  Type,
} from "lucide-react";
import type { CSSProperties } from "react";

/**
 * Мок-данные модуля «Дизайн»: единый редактор (растр + макеты + превью IDE).
 * Всё содержимое — плейсхолдеры для визуального макета, без бэкенда.
 */

/* ────────────────────────── Общие типы ────────────────────────── */

/** Активный режим редактора. */
export type DesignMode = "raster" | "layout" | "preview";

/** Тип файла в каталоге. */
export type DesignKind = "raster" | "layout" | "preview";

export interface DesignFile {
  id: string;
  name: string;
  kind: DesignKind;
  /** Режим, в котором открывается файл. */
  mode: DesignMode;
  /** Человекочитаемое «когда меняли». */
  updated: string;
  /** Для сортировки «по обновлению». */
  updatedTs: number;
  meta: string;
}

export const RECENT_FILES: DesignFile[] = [
  {
    id: "r1",
    name: "кадр-раскадровки-03.png",
    kind: "raster",
    mode: "raster",
    updated: "5 мин назад",
    updatedTs: 9,
    meta: "2048 × 1365 · 5 слоёв",
  },
  {
    id: "r2",
    name: "обложка-подкаста.png",
    kind: "raster",
    mode: "raster",
    updated: "вчера, 21:40",
    updatedTs: 7,
    meta: "1400 × 1400 · 3 слоя",
  },
  {
    id: "l1",
    name: "лендинг-v2",
    kind: "layout",
    mode: "layout",
    updated: "2 ч назад",
    updatedTs: 8,
    meta: "2 фрейма · 12 элементов",
  },
  {
    id: "l2",
    name: "дашборд-мобайл",
    kind: "layout",
    mode: "layout",
    updated: "3 дня назад",
    updatedTs: 4,
    meta: "1 фрейм · 8 элементов",
  },
  {
    id: "p1",
    name: "превью-лендинга",
    kind: "preview",
    mode: "preview",
    updated: "только что",
    updatedTs: 10,
    meta: "localhost:3000 · 6 элементов",
  },
  {
    id: "p2",
    name: "кабинет-автора",
    kind: "preview",
    mode: "preview",
    updated: "вчера, 18:02",
    updatedTs: 6,
    meta: "localhost:3000 · 5 элементов",
  },
];

export const KIND_META: Record<
  DesignKind,
  { label: string; icon: LucideIcon }
> = {
  raster: { label: "Растр", icon: Image },
  layout: { label: "Макет", icon: Frame },
  preview: { label: "Превью", icon: Monitor },
};

/** Общая палитра для «пипетки»/заливок (stone + emerald/teal/amber). */
export const FILL_PALETTE: string[] = [
  "#0c0a09",
  "#1c1917",
  "#292524",
  "#44403c",
  "#78716c",
  "#d6d3d1",
  "#f5f5f4",
  "#059669",
  "#0d9488",
  "#b45309",
];

/* ────────────────────────── Растр: инструменты ────────────────────────── */

export interface RasterTool {
  id: string;
  name: string;
  hotkey: string;
  icon: LucideIcon;
}

export const RASTER_TOOLS: RasterTool[] = [
  { id: "move", name: "Перемещение", hotkey: "V", icon: Move },
  { id: "brush", name: "Кисть", hotkey: "B", icon: Brush },
  { id: "eraser", name: "Ластик", hotkey: "E", icon: Eraser },
  { id: "select", name: "Выделение", hotkey: "M", icon: BoxSelect },
  { id: "crop", name: "Кадрирование", hotkey: "C", icon: Crop },
  { id: "text", name: "Текст", hotkey: "T", icon: Type },
  { id: "shapes", name: "Фигуры", hotkey: "U", icon: Shapes },
  { id: "pipette", name: "Пипетка", hotkey: "I", icon: Pipette },
];

/* ──────────────────── Растр: холст «Зимний перевал» ──────────────────── */

export const ART_W = 720;
export const ART_H = 480;

/** Слой растрового макета: абсолютный div поверх холста. */
export interface RasterLayerDef {
  id: string;
  name: string;
  icon: LucideIcon;
  visible: boolean;
  /** 0–100, применяется как CSS opacity. */
  opacity: number;
  locked: boolean;
  /** Стиль абсолютного div-слоя (фон, clip-path, фильтры…). */
  style: CSSProperties;
  /** Текстовый слой: содержимое + стиль надписи. */
  text?: string;
  textStyle?: CSSProperties;
}

export const RASTER_LAYERS: RasterLayerDef[] = [
  {
    id: "text",
    name: "Текст «Зимний перевал»",
    icon: Type,
    visible: true,
    opacity: 100,
    locked: false,
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      paddingBottom: "11%",
    },
    text: "Зимний перевал",
    textStyle: {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: 42,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "#f5f5f4",
      textShadow: "0 2px 26px rgba(0,0,0,0.65)",
    },
  },
  {
    id: "light",
    name: "Свет",
    icon: SunMedium,
    visible: true,
    opacity: 85,
    locked: false,
    style: {
      background:
        "radial-gradient(circle at 72% 20%, rgba(254,243,199,0.95) 0 1.1%, rgba(254,243,199,0.4) 2.4%, rgba(254,243,199,0.1) 6%, transparent 15%), radial-gradient(ellipse at 50% 108%, rgba(16,185,129,0.12), transparent 55%)",
    },
  },
  {
    id: "fog",
    name: "Туман",
    icon: CloudFog,
    visible: true,
    opacity: 75,
    locked: false,
    style: {
      top: "52%",
      height: "28%",
      background:
        "linear-gradient(90deg, transparent 0%, rgba(214,211,209,0.55) 22%, rgba(231,229,228,0.7) 50%, rgba(214,211,209,0.5) 78%, transparent 100%)",
      filter: "blur(9px)",
    },
  },
  {
    id: "mountains",
    name: "Горы",
    icon: Mountain,
    visible: true,
    opacity: 100,
    locked: false,
    style: {
      top: "40%",
      left: "-2%",
      right: "-2%",
      bottom: "-2%",
      clipPath:
        "polygon(0% 100%, 0% 55%, 7% 66%, 14% 38%, 21% 52%, 29% 26%, 38% 48%, 46% 34%, 55% 12%, 64% 40%, 73% 30%, 82% 52%, 90% 40%, 100% 58%, 100% 100%)",
      background:
        "linear-gradient(180deg, #f5f5f4 0%, #d6d3d1 8%, #a8a29e 18%, #78716c 32%, #44403c 52%, #2b312d 78%, #1c231f 100%)",
    },
  },
  {
    id: "background",
    name: "Фон",
    icon: Image,
    visible: true,
    opacity: 100,
    locked: true,
    style: {
      background:
        "radial-gradient(1.5px 1.5px at 12% 12%, rgba(250,250,249,0.9) 50%, transparent 51%)," +
        "radial-gradient(1px 1px at 28% 7%, rgba(250,250,249,0.6) 50%, transparent 51%)," +
        "radial-gradient(1.2px 1.2px at 41% 16%, rgba(250,250,249,0.75) 50%, transparent 51%)," +
        "radial-gradient(1px 1px at 55% 9%, rgba(250,250,249,0.5) 50%, transparent 51%)," +
        "radial-gradient(1.4px 1.4px at 64% 14%, rgba(250,250,249,0.8) 50%, transparent 51%)," +
        "radial-gradient(1px 1px at 79% 6%, rgba(250,250,249,0.55) 50%, transparent 51%)," +
        "radial-gradient(1.3px 1.3px at 90% 11%, rgba(250,250,249,0.7) 50%, transparent 51%)," +
        "linear-gradient(180deg, #0a0a09 0%, #1c1917 45%, #35302c 60%, #4f4335 68%, #262220 82%, #14120f 100%)",
    },
  },
];

/* ────────────────────────── Растр: фильтры и LUT ────────────────────────── */

export interface RasterFilters {
  /** 0–200, 100 = без изменений. */
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: boolean;
}

export const DEFAULT_FILTERS: RasterFilters = {
  brightness: 104,
  contrast: 106,
  saturate: 92,
  grayscale: false,
};

export interface LutPreset {
  id: string;
  name: string;
  /** Градиент плитки-превью в каталоге. */
  tileCss: string;
  /** Оверлей поверх холста. */
  overlayCss: string;
  blend: CSSProperties["mixBlendMode"];
  overlayOpacity: number;
}

export const LUT_PRESETS: LutPreset[] = [
  {
    id: "warm",
    name: "Тёплый",
    tileCss: "linear-gradient(135deg, #d97706, #78350f)",
    overlayCss:
      "linear-gradient(135deg, rgba(217,119,6,0.5), rgba(120,53,15,0.38))",
    blend: "overlay",
    overlayOpacity: 0.9,
  },
  {
    id: "cold",
    name: "Холодный",
    tileCss: "linear-gradient(135deg, #0d9488, #065f46)",
    overlayCss:
      "linear-gradient(135deg, rgba(13,148,136,0.45), rgba(6,95,70,0.4))",
    blend: "soft-light",
    overlayOpacity: 1,
  },
  {
    id: "night",
    name: "Ночь",
    tileCss: "linear-gradient(135deg, #1c2b26, #0c0a09)",
    overlayCss:
      "linear-gradient(135deg, rgba(12,10,9,0.68), rgba(28,37,32,0.5))",
    blend: "multiply",
    overlayOpacity: 0.85,
  },
  {
    id: "retro",
    name: "Ретро",
    tileCss: "linear-gradient(135deg, #b45309, #a8a29e)",
    overlayCss:
      "linear-gradient(135deg, rgba(180,83,9,0.32), rgba(168,162,158,0.36))",
    blend: "soft-light",
    overlayOpacity: 0.9,
  },
];

export interface BrushSettings {
  size: number;
  hardness: number;
  color: string;
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 24,
  hardness: 80,
  color: "#059669",
};

/* ────────────────────────── Растр: история ────────────────────────── */

export interface HistoryItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const HISTORY_SEED: HistoryItem[] = [
  { id: "h1", label: "Документ открыт", icon: FileImage },
  { id: "h2", label: "Кадрирование 3:2", icon: Crop },
  { id: "h3", label: "Добавлен слой «Туман»", icon: Plus },
  { id: "h4", label: "Кисть ×23", icon: Brush },
  { id: "h5", label: "Яркость → 104", icon: SunMedium },
  { id: "h6", label: "Контраст → 106", icon: Contrast },
  { id: "h7", label: "Текст «Зимний перевал»", icon: Type },
];

