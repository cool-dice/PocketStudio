import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  AudioWaveform,
  BookOpenText,
  Clapperboard,
  Feather,
  ImagePlus,
  Languages,
  Palette,
  Scissors,
  Timer,
  TrendingUp,
} from "lucide-react";

/** Where a skill came from — affects the badge on the card. */
export type SkillSource = "builtin" | "created" | "imported";

export const SOURCE_META: Record<
  SkillSource,
  { label: string; className: string }
> = {
  builtin: {
    label: "Встроен",
    className: "border-transparent bg-secondary text-secondary-foreground",
  },
  created: {
    label: "Создан",
    className:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  imported: {
    label: "Импортирован",
    className: "border-border bg-background text-muted-foreground",
  },
};

export interface MySkill {
  id: string;
  name: string;
  description: string;
  /** Semver without the leading "v" — rendered as `v{version}` in mono. */
  version: string;
  source: SkillSource;
  enabled: boolean;
  usedCount: number;
  icon: LucideIcon;
  /** Phrase triggers the orchestrator matches against. */
  triggers: string[];
  /** Rendered verbatim inside the dark SKILL.md block. */
  skillMd: string;
}

export const MY_SKILLS: MySkill[] = [
  {
    id: "book-copywriter",
    name: "Копирайтер книг",
    description: "Черновики глав в вашем тоне, продолжение сюжета по канону",
    version: "2.1",
    source: "builtin",
    enabled: true,
    usedCount: 34,
    icon: BookOpenText,
    triggers: ["напиши главу", "продолжи текст"],
    skillMd: `---
name: Копирайтер книг
triggers: ["напиши главу", "продолжи текст"]
---

## Когда использовать
Черновики глав книги, расширение сюжета, удержание тона повествования.

## Шаги
1. Прочитать структуру книги
2. Сохранить тон повествования
3. Сгенерировать черновик
4. Свериться с каноном мира

## Инструменты
read_file · write_file · notes.search`,
  },
  {
    id: "scene-storyboard",
    name: "Раскадровщик сцен",
    description: "Сценарий → кадры: описание планов, ракурсов и мизансцены",
    version: "1.8",
    source: "builtin",
    enabled: true,
    usedCount: 12,
    icon: Clapperboard,
    triggers: ["раскадруй сцену", "сделай сториборд"],
    skillMd: `---
name: Раскадровщик сцен
triggers: ["раскадруй сцену", "сделай сториборд"]
---

## Когда использовать
Превращение готовой сцены в последовательность кадров для видео.

## Шаги
1. Разбить сцену на смысловые биты
2. Для каждого бита задать план и ракурс
3. Описать движение камеры словами
4. Собрать таблицу кадров

## Инструменты
read_file · write_file`,
  },
  {
    id: "voice-tone-studio",
    name: "Тон голоса: Студия",
    description: "Дружелюбный «мы» с лёгким юмором — фирменный тон студии",
    version: "1.0",
    source: "created",
    enabled: true,
    usedCount: 8,
    icon: AudioWaveform,
    triggers: ["смени тон", "в тоне студии"],
    skillMd: `---
name: Тон голоса: Студия
triggers: ["смени тон", "в тоне студии"]
---

## Когда использовать
Любой текст, который видит читатель: книги, посты, описания работ.

## Шаги
1. Прочитать черновик
2. Заменить канцелярит на живые формулировки
3. Проверить обращение «вы/мы»

## Инструменты
read_file · write_file`,
  },
  {
    id: "seo-optimizer",
    name: "SEO-оптимизатор статей",
    description: "Ключевые слова, мета-описания и структура под поиск",
    version: "3.2",
    source: "imported",
    enabled: false,
    usedCount: 3,
    icon: TrendingUp,
    triggers: ["оптимизируй статью", "seo-правки"],
    skillMd: `---
name: SEO-оптимизатор статей
triggers: ["оптимизируй статью", "seo-правки"]
---

## Когда использовать
Финальная шлифовка статьи перед публикацией на внешних платформах.

## Шаги
1. Собрать ключевое ядро по теме
2. Вписать ключи в заголовки без переспама
3. Проверить длину мета-описания
4. Предложить FAQ-блок

## Инструменты
read_file · web.search`,
  },
  {
    id: "concept-illustrator",
    name: "Иллюстратор концептов",
    description: "Промпты для обложек и концепт-арта по описанию сцены",
    version: "1.4",
    source: "builtin",
    enabled: true,
    usedCount: 21,
    icon: Palette,
    triggers: ["нарисуй концепт", "обложка для книги"],
    skillMd: `---
name: Иллюстратор концептов
triggers: ["нарисуй концепт", "обложка для книги"]
---

## Когда использовать
Обложки, иллюстрации к главам, концепты персонажей и локаций.

## Шаги
1. Извлечь визуальные якоря из текста
2. Собрать промпт с композицией и светом
3. Сгенерировать 3 варианта
4. Предложить финалиста

## Инструменты
image.generate · read_file`,
  },
  {
    id: "montage-advisor",
    name: "Монтажёр-подсказчик",
    description: "Подсказки по ритму монтажа и переходам между кадрами",
    version: "0.9",
    source: "imported",
    enabled: false,
    usedCount: 1,
    icon: Scissors,
    triggers: ["совет по монтажу", "склей сцену"],
    skillMd: `---
name: Монтажёр-подсказчик
triggers: ["совет по монтажу", "склей сцену"]
---

## Когда использовать
Сборка видео из раскадровки: ритм, переходы, музыкальные акценты.

## Шаги
1. Прочитать раскадровку
2. Найти ритмические группы кадров
3. Предложить переходы и темп

## Инструменты
read_file · video.render`,
  },
];

export interface StoreSkill {
  id: string;
  name: string;
  description: string;
  rating: number;
  reviews: number;
  icon: LucideIcon;
}

export const STORE_SKILLS: StoreSkill[] = [
  {
    id: "hemingway-rewrite",
    name: "Рерайт в стиле Хемингуэя",
    description: "Короткие фразы, активный залог, ноль воды",
    rating: 4.8,
    reviews: 214,
    icon: Feather,
  },
  {
    id: "cover-generator",
    name: "Генератор обложек",
    description: "Обложки книг и треков под вашу серию работ",
    rating: 4.9,
    reviews: 356,
    icon: ImagePlus,
  },
  {
    id: "trailer-sound",
    name: "Саунд-дизайнер трейлеров",
    description: "Интро, аутро и ударные акценты для трейлеров",
    rating: 4.6,
    reviews: 98,
    icon: AudioLines,
  },
  {
    id: "author-time",
    name: "Тайм-менеджмент автора",
    description: "Планирует спринты письма и держит дедлайны",
    rating: 4.4,
    reviews: 121,
    icon: Timer,
  },
  {
    id: "translator-12",
    name: "Переводчик на 12 языков",
    description: "Художественный перевод с сохранением метафор",
    rating: 4.7,
    reviews: 189,
    icon: Languages,
  },
];
