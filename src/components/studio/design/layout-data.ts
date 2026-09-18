/**
 * Мок-данные режимов «Макет» (Figma-lite) и «Превью (IDE)» модуля «Дизайн»:
 * фреймы и элементы лендинга, компоненты, шрифты, элементы IDE-превью.
 * Плейсхолдеры для визуального макета, без бэкенда.
 */

/* ──────────────────── Макет: фреймы и слои ──────────────────── */

export type NodeKind =
  | "header"
  | "hero"
  | "cards"
  | "footer"
  | "button"
  | "card"
  | "input"
  | "m-hero"
  | "m-list"
  | "m-tabbar";

export interface NodeFont {
  family: string;
  size: number;
  weight: 400 | 500 | 600 | 700;
}

export interface LayoutNode {
  id: string;
  name: string;
  /** Тег для инспектора. */
  tag: string;
  kind: NodeKind;
  /** Координаты в системе фрейма (не масштабированные). */
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  radius: number;
  shadow: boolean;
  shadowBlur: number;
  font?: NodeFont;
}

export interface LayoutFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Отображаемый масштаб на холсте. */
  scale: number;
  /** Фон «страницы» внутри фрейма. */
  pageFill: string;
  nodes: LayoutNode[];
}

const SERIF = "Georgia, 'Times New Roman', serif";

export const DESKTOP_FRAME: LayoutFrame = {
  id: "desktop",
  name: "Главная",
  width: 1440,
  height: 900,
  scale: 0.5,
  pageFill: "#100f0e",
  nodes: [
    {
      id: "header",
      name: "Хедер",
      tag: "header",
      kind: "header",
      x: 0,
      y: 0,
      w: 1440,
      h: 72,
      fill: "#171512",
      radius: 0,
      shadow: false,
      shadowBlur: 0,
    },
    {
      id: "hero",
      name: "Хиро",
      tag: "section",
      kind: "hero",
      x: 80,
      y: 168,
      w: 1280,
      h: 340,
      fill: "#151311",
      radius: 16,
      shadow: true,
      shadowBlur: 24,
      font: { family: SERIF, size: 64, weight: 600 },
    },
    {
      id: "cards",
      name: "Карточки ×3",
      tag: "section",
      kind: "cards",
      x: 80,
      y: 560,
      w: 1280,
      h: 240,
      fill: "transparent",
      radius: 12,
      shadow: false,
      shadowBlur: 0,
    },
    {
      id: "footer",
      name: "Футер",
      tag: "footer",
      kind: "footer",
      x: 0,
      y: 828,
      w: 1440,
      h: 72,
      fill: "#121110",
      radius: 0,
      shadow: false,
      shadowBlur: 0,
    },
  ],
};

export const MOBILE_FRAME: LayoutFrame = {
  id: "mobile",
  name: "Онбординг",
  width: 390,
  height: 844,
  scale: 0.5,
  pageFill: "#100f0e",
  nodes: [
    {
      id: "m-hero",
      name: "Хиро",
      tag: "section",
      kind: "m-hero",
      x: 24,
      y: 140,
      w: 342,
      h: 300,
      fill: "#151311",
      radius: 20,
      shadow: true,
      shadowBlur: 20,
      font: { family: SERIF, size: 30, weight: 600 },
    },
    {
      id: "m-list",
      name: "Список глав",
      tag: "ul",
      kind: "m-list",
      x: 24,
      y: 476,
      w: 342,
      h: 256,
      fill: "transparent",
      radius: 12,
      shadow: false,
      shadowBlur: 0,
    },
    {
      id: "m-tabbar",
      name: "Таб-бар",
      tag: "nav",
      kind: "m-tabbar",
      x: 0,
      y: 780,
      w: 390,
      h: 64,
      fill: "#171512",
      radius: 0,
      shadow: true,
      shadowBlur: 16,
    },
  ],
};

/** Палитра компонентов для выпадающего меню «Компоненты». */
export const COMPONENT_ITEMS = [
  { kind: "button" as NodeKind, name: "Кнопка", w: 180, h: 52, fill: "#059669" },
  { kind: "card" as NodeKind, name: "Карточка", w: 300, h: 190, fill: "#1a1917" },
  { kind: "input" as NodeKind, name: "Инпут", w: 300, h: 48, fill: "#1c1917" },
];

export const FONT_FAMILIES = [
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia · сериф" },
  { value: "system-ui, -apple-system, sans-serif", label: "System · гротеск" },
  {
    value: "ui-monospace, 'JetBrains Mono', monospace",
    label: "Mono · моно",
  },
];

export const FONT_WEIGHTS: { value: 400 | 500 | 600 | 700; label: string }[] = [
  { value: 400, label: "400" },
  { value: 500, label: "500" },
  { value: 600, label: "600" },
  { value: 700, label: "700" },
];

/* ──────────────────── Превью (IDE): элементы ──────────────────── */

export interface IdeElement {
  id: string;
  tag: string;
  className: string;
  /** Подпись-селектор, например «aside.app-sidebar». */
  label: string;
  filePath: string;
  line: number;
  size: string;
  color: string;
  padding: string;
}

export const IDE_ELEMENTS: IdeElement[] = [
  {
    id: "root",
    tag: "div",
    className: "app-shell",
    label: "div.app-shell",
    filePath: "src/app/page.tsx",
    line: 42,
    size: "1200 × 844",
    color: "#100f0e",
    padding: "0",
  },
  {
    id: "sidebar",
    tag: "aside",
    className: "app-sidebar",
    label: "aside.app-sidebar",
    filePath: "src/components/app/sidebar.tsx",
    line: 18,
    size: "208 × 844",
    color: "#131110",
    padding: "16 px",
  },
  {
    id: "topbar",
    tag: "header",
    className: "topbar",
    label: "header.topbar",
    filePath: "src/components/app/topbar.tsx",
    line: 6,
    size: "992 × 64",
    color: "#100f0e",
    padding: "12 px 20 px",
  },
  {
    id: "cta",
    tag: "button",
    className: "btn-primary",
    label: "button.btn-primary",
    filePath: "src/components/ui/button.tsx",
    line: 42,
    size: "152 × 32",
    color: "#059669",
    padding: "8 px 14 px",
  },
  {
    id: "stats",
    tag: "section",
    className: "stat-grid",
    label: "section.stat-grid",
    filePath: "src/components/dashboard/stat-card.tsx",
    line: 12,
    size: "944 × 132",
    color: "#171512",
    padding: "16 px",
  },
  {
    id: "chart",
    tag: "div",
    className: "chart-card",
    label: "div.chart-card",
    filePath: "src/components/dashboard/chart.tsx",
    line: 31,
    size: "944 × 200",
    color: "#171512",
    padding: "20 px",
  },
  {
    id: "table",
    tag: "table",
    className: "leads-table",
    label: "table.leads-table",
    filePath: "src/components/dashboard/leads-table.tsx",
    line: 9,
    size: "944 × 192",
    color: "#171512",
    padding: "12 px",
  },
];

/** Быстрый доступ к элементам превью по id (для инспектора и вьюпорта). */
export const IDE_ELEMENT_MAP: Record<string, IdeElement> = Object.fromEntries(
  IDE_ELEMENTS.map((e) => [e.id, e]),
);
