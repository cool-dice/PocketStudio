import type { LucideIcon } from "lucide-react";
import {
  Castle,
  Building2,
  CloudRain,
  Coffee,
  Feather,
  Flame,
  Flower2,
  Gamepad2,
  ImagePlus,
  Map,
  Palette,
  Radio,
  Rocket,
  Sparkles,
  Sunrise,
  TreePine,
  User,
  Wand2,
} from "lucide-react";

/** —— Доменные типы галереи изображений (визуальный макет) —— */

export type ImageRatio = "1:1" | "4:3" | "16:9" | "9:16";
export type ImageStatus = "ready" | "generating" | "draft";

export interface GalleryTile {
  id: string;
  prompt: string;
  /** Название стилевого пресета. */
  style: string;
  ratio: ImageRatio;
  /** CSS-градиент «картинки» — единственный источник визуала, без внешних изображений. */
  gradient: string;
  icon: LucideIcon;
  seed: number;
  createdAt: string;
  likes: number;
  favorite: boolean;
  status: ImageStatus;
}

export const IMAGE_STYLES = [
  "Кинематографично",
  "Акварель",
  "Пиксель-арт",
  "Аниме",
  "3D-рендер",
  "Фотореализм",
] as const;

export const RATIOS: ImageRatio[] = ["1:1", "4:3", "16:9", "9:16"];

export const SAMPLE_PROMPTS = [
  {
    label: "Обложка фэнтези-книги",
    prompt:
      "Обложка фэнтези-книги: одинокая башня мага над туманным лесом, лунный свет, развевающийся плащ",
  },
  {
    label: "Портрет в стиле нуар",
    prompt:
      "Портрет детектива в стиле нуар: дождливая улица, жёлтый свет фонаря, контрастные тени",
  },
  {
    label: "Изометрическая карта",
    prompt:
      "Изометрическая карта средневековой деревни с мельницей, речкой и рыночной площадью",
  },
  {
    label: "Логотип для подкаста",
    prompt:
      "Минималистичный логотип подкаста о книгах: перо, переходящее в звуковую волну, круглая рамка",
  },
] as const;

/** Класс пропорций контейнера под каждое соотношение сторон. */
export function ratioBox(ratio: ImageRatio): string {
  switch (ratio) {
    case "1:1":
      return "aspect-square";
    case "4:3":
      return "aspect-[4/3]";
    case "16:9":
      return "aspect-video";
    case "9:16":
      return "aspect-[9/16]";
  }
}

/** Подпись разрешения в пикселях. */
export function ratioSize(ratio: ImageRatio): string {
  switch (ratio) {
    case "1:1":
      return "1024×1024";
    case "4:3":
      return "1024×768";
    case "16:9":
      return "1280×720";
    case "9:16":
      return "768×1344";
  }
}

/** Точечная сетка поверх градиента — «текстура» макетных превью. */
export const DOT_PATTERN_STYLE = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1.4px)",
  backgroundSize: "13px 13px",
} as const;

/** —— Начальная галерея: 14 «готовых» работ студии —— */

export const INITIAL_TILES: GalleryTile[] = [
  {
    id: "img-01",
    prompt: "Неоновый город на закате в стиле киберпанк-акварель, мокрый асфальт, отражения вывесок",
    style: "Кинематографично",
    ratio: "16:9",
    gradient: "linear-gradient(140deg,#fb923c 0%,#c2410c 55%,#7c2d12 100%)",
    icon: Building2,
    seed: 184592,
    createdAt: "Сегодня, 09:12",
    likes: 128,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-02",
    prompt: "Обложка фэнтези-книги: одинокая башня мага над туманным лесом, лунный свет",
    style: "Акварель",
    ratio: "4:3",
    gradient: "radial-gradient(circle at 30% 25%,#34d399 0%,#065f46 55%,#022c22 100%)",
    icon: Castle,
    seed: 240117,
    createdAt: "Сегодня, 08:40",
    likes: 214,
    favorite: true,
    status: "ready",
  },
  {
    id: "img-03",
    prompt: "Портрет детектива в нуар-стиле: дождь, жёлтый свет фонаря, резкие контрастные тени",
    style: "Фотореализм",
    ratio: "9:16",
    gradient: "linear-gradient(135deg,#71717a 0%,#52525b 50%,#27272a 100%)",
    icon: User,
    seed: 90731,
    createdAt: "Вчера, 23:05",
    likes: 96,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-04",
    prompt: "Изометрическая карта средневековой деревни с мельницей, речкой и рыночной площадью",
    style: "3D-рендер",
    ratio: "1:1",
    gradient: "linear-gradient(150deg,#a8a29e 0%,#78716c 55%,#57534e 100%)",
    icon: Map,
    seed: 311884,
    createdAt: "Вчера, 18:22",
    likes: 87,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-05",
    prompt: "Маскот подкаста о книгах: рыжая лиса в больших наушниках, читает свиток",
    style: "Пиксель-арт",
    ratio: "1:1",
    gradient: "linear-gradient(140deg,#10b981 0%,#059669 45%,#065f46 100%)",
    icon: Radio,
    seed: 55219,
    createdAt: "Вчера, 12:03",
    likes: 156,
    favorite: true,
    status: "ready",
  },
  {
    id: "img-06",
    prompt: "Герой аниме на рассвете смотрит на мегаполис с крыши, ветер развевает куртку",
    style: "Аниме",
    ratio: "16:9",
    gradient: "linear-gradient(140deg,#f59e0b 0%,#b45309 55%,#7c2d12 100%)",
    icon: Sunrise,
    seed: 128476,
    createdAt: "Вчера, 10:41",
    likes: 178,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-07",
    prompt: "Минималистичный логотип для подкаста о книгах: перо и звуковая волна, круглая рамка",
    style: "3D-рендер",
    ratio: "1:1",
    gradient: "linear-gradient(160deg,#0d9488 0%,#115e59 55%,#134e4a 100%)",
    icon: Feather,
    seed: 74023,
    createdAt: "2 дня назад",
    likes: 64,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-08",
    prompt: "Лесное озеро в утреннем тумане, зеркальная вода, силуэт лодки на дальнем плане",
    style: "Кинематографично",
    ratio: "16:9",
    gradient: "linear-gradient(160deg,#4d7c0f 0%,#3f6212 60%,#1a2e05 100%)",
    icon: TreePine,
    seed: 200945,
    createdAt: "2 дня назад",
    likes: 143,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-09",
    prompt: "Космическая станция на орбите газового гиганта, кольца планеты, солнечный блик",
    style: "3D-рендер",
    ratio: "16:9",
    gradient: "linear-gradient(135deg,#059669 0%,#047857 45%,#064e3b 100%)",
    icon: Rocket,
    seed: 63310,
    createdAt: "3 дня назад",
    likes: 201,
    favorite: true,
    status: "ready",
  },
  {
    id: "img-10",
    prompt: "Акварельный букет полевых цветов на льняном фоне, нежные размывы",
    style: "Акварель",
    ratio: "1:1",
    gradient: "linear-gradient(150deg,#d6d3d1 0%,#a8a29e 45%,#57534e 100%)",
    icon: Flower2,
    seed: 87164,
    createdAt: "3 дня назад",
    likes: 74,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-11",
    prompt: "Уютная книжная кофейня в изометрии: полки, лампы, кот спит на стопке книг",
    style: "3D-рендер",
    ratio: "4:3",
    gradient: "linear-gradient(135deg,#fb923c 0%,#c2410c 55%,#7c2d12 100%)",
    icon: Coffee,
    seed: 149502,
    createdAt: "4 дня назад",
    likes: 119,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-12",
    prompt: "Самурай под цветущей сакурой в дождь, капли на коже, глубокие тени",
    style: "Аниме",
    ratio: "9:16",
    gradient: "linear-gradient(140deg,#f43f5e 0%,#be123c 55%,#4c0519 100%)",
    icon: CloudRain,
    seed: 41887,
    createdAt: "5 дней назад",
    likes: 167,
    favorite: true,
    status: "ready",
  },
  {
    id: "img-13",
    prompt: "Дракон из папье-маше в студийном свете, детальная фактура бумаги",
    style: "Фотореализм",
    ratio: "1:1",
    gradient: "linear-gradient(135deg,#57534e 0%,#44403c 45%,#1c1917 100%)",
    icon: Flame,
    seed: 302748,
    createdAt: "6 дней назад",
    likes: 58,
    favorite: false,
    status: "ready",
  },
  {
    id: "img-14",
    prompt: "Ретро-аркада 80-х с неоновой вывеской, автоматы в ряд, панк-зал",
    style: "Пиксель-арт",
    ratio: "16:9",
    gradient: "linear-gradient(160deg,#2dd4bf 0%,#0d9488 50%,#115e59 100%)",
    icon: Gamepad2,
    seed: 96501,
    createdAt: "неделю назад",
    likes: 132,
    favorite: false,
    status: "ready",
  },
];

/** —— Палитра для свежесгенерированных макетных плиток —— */

const DRAFT_GRADIENTS = [
  "linear-gradient(135deg,#059669 0%,#065f46 100%)",
  "linear-gradient(135deg,#0d9488 0%,#134e4a 100%)",
  "linear-gradient(135deg,#b45309 0%,#7c2d12 100%)",
  "linear-gradient(135deg,#52525b 0%,#27272a 100%)",
  "linear-gradient(135deg,#4d7c0f 0%,#1a2e05 100%)",
];

const DRAFT_ICONS: LucideIcon[] = [Wand2, Sparkles, ImagePlus, Palette];

let draftCounter = 0;

/** Новая плитка в состоянии «генерация» — встанет в верх галереи. */
export function makeGeneratingTile(
  prompt: string,
  style: string,
  ratio: ImageRatio,
): GalleryTile {
  draftCounter += 1;
  const n = draftCounter;
  return {
    id: `gen-${Date.now()}-${n}`,
    prompt: prompt.trim() || "Изображение по описанию студии",
    style,
    ratio,
    gradient: DRAFT_GRADIENTS[n % DRAFT_GRADIENTS.length]!,
    icon: DRAFT_ICONS[n % DRAFT_ICONS.length]!,
    seed: 100003 + ((n * 7919) % 899999),
    createdAt: "Сейчас",
    likes: 0,
    favorite: false,
    status: "generating",
  };
}
