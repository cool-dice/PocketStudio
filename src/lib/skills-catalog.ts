/**
 * Builtin skills + store catalog (F1).
 * Seeded into Skill rows on first GET /api/skills.
 * Store items are importable; purchase is an internal flag, not Stripe.
 */

export type SkillSource = "builtin" | "created" | "imported" | "store";

export interface SkillCatalogItem {
  key: string;
  name: string;
  description: string;
  version: string;
  source: "builtin" | "store";
  icon: string;
  triggers: string[];
  skillMd: string;
  /** Store-only: shown in the shop until imported. */
  rating?: number;
  reviews?: number;
  defaultEnabled?: boolean;
}

function md(
  name: string,
  triggers: string[],
  when: string,
  steps: string[],
  tools: string,
): string {
  return `---
name: ${name}
triggers: ${JSON.stringify(triggers)}
---

## Когда использовать
${when}

## Шаги
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Инструменты
${tools}
`;
}

export const BUILTIN_SKILLS: SkillCatalogItem[] = [
  {
    key: "book-copywriter",
    name: "Копирайтер книг",
    description: "Черновики глав в вашем тоне, продолжение сюжета по канону",
    version: "2.1",
    source: "builtin",
    icon: "BookOpenText",
    defaultEnabled: true,
    triggers: ["напиши главу", "продолжи текст"],
    skillMd: md(
      "Копирайтер книг",
      ["напиши главу", "продолжи текст"],
      "Черновики глав книги, расширение сюжета, удержание тона повествования.",
      [
        "Прочитать структуру книги",
        "Сохранить тон повествования",
        "Сгенерировать черновик",
        "Свериться с каноном мира",
      ],
      "create_document · append_section · rewrite_section · check_document",
    ),
  },
  {
    key: "scene-storyboard",
    name: "Раскадровщик сцен",
    description: "Сценарий → кадры: описание планов, ракурсов и мизансцены",
    version: "1.8",
    source: "builtin",
    icon: "Clapperboard",
    defaultEnabled: true,
    triggers: ["раскадруй сцену", "сделай сториборд"],
    skillMd: md(
      "Раскадровщик сцен",
      ["раскадруй сцену", "сделай сториборд"],
      "Превращение готовой сцены в последовательность кадров для видео.",
      [
        "Разбить сцену на смысловые биты",
        "Для каждого бита задать план и ракурс",
        "Описать движение камеры словами",
        "Собрать таблицу кадров",
      ],
      "create_document · generate_image",
    ),
  },
  {
    key: "voice-tone-studio",
    name: "Тон голоса: Студия",
    description: "Дружелюбный «мы» с лёгким юмором — фирменный тон студии",
    version: "1.0",
    source: "builtin",
    icon: "AudioWaveform",
    defaultEnabled: true,
    triggers: ["смени тон", "в тоне студии"],
    skillMd: md(
      "Тон голоса: Студия",
      ["смени тон", "в тоне студии"],
      "Любой текст, который видит читатель: книги, посты, описания работ.",
      [
        "Прочитать черновик",
        "Заменить канцелярит на живые формулировки",
        "Проверить обращение «вы/мы»",
      ],
      "rewrite_section · create_note",
    ),
  },
  {
    key: "concept-illustrator",
    name: "Иллюстратор концептов",
    description: "Промпты для обложек и концепт-арта по описанию сцены",
    version: "1.4",
    source: "builtin",
    icon: "Palette",
    defaultEnabled: true,
    triggers: ["нарисуй концепт", "обложка для книги"],
    skillMd: md(
      "Иллюстратор концептов",
      ["нарисуй концепт", "обложка для книги"],
      "Обложки, иллюстрации к главам, концепты персонажей и локаций.",
      [
        "Извлечь визуальные якоря из текста",
        "Собрать промпт с композицией и светом",
        "Сгенерировать варианты",
        "Предложить финалиста",
      ],
      "generate_image",
    ),
  },
];

export const STORE_SKILLS: SkillCatalogItem[] = [
  {
    key: "seo-optimizer",
    name: "SEO-оптимизатор статей",
    description: "Ключевые слова, мета-описания и структура под поиск",
    version: "3.2",
    source: "store",
    icon: "TrendingUp",
    rating: 4.5,
    reviews: 88,
    triggers: ["оптимизируй статью", "seo-правки"],
    skillMd: md(
      "SEO-оптимизатор статей",
      ["оптимизируй статью", "seo-правки"],
      "Финальная шлифовка статьи перед публикацией на внешних платформах.",
      [
        "Собрать ключевое ядро по теме",
        "Вписать ключи в заголовки без переспама",
        "Проверить длину мета-описания",
        "Предложить FAQ-блок",
      ],
      "rewrite_section",
    ),
  },
  {
    key: "montage-advisor",
    name: "Монтажёр-подсказчик",
    description: "Подсказки по ритму монтажа и переходам между кадрами",
    version: "0.9",
    source: "store",
    icon: "Scissors",
    rating: 4.4,
    reviews: 41,
    triggers: ["совет по монтажу", "склей сцену"],
    skillMd: md(
      "Монтажёр-подсказчик",
      ["совет по монтажу", "склей сцену"],
      "Сборка видео из раскадровки: ритм, переходы, музыкальные акценты.",
      [
        "Прочитать раскадровку",
        "Найти ритмические группы кадров",
        "Предложить переходы и темп",
      ],
      "create_document",
    ),
  },
  {
    key: "hemingway-rewrite",
    name: "Рерайт в стиле Хемингуэя",
    description: "Короткие фразы, активный залог, ноль воды",
    version: "1.2",
    source: "store",
    icon: "Feather",
    rating: 4.8,
    reviews: 214,
    triggers: ["хемингуэй", "короче и жёстче"],
    skillMd: md(
      "Рерайт в стиле Хемингуэя",
      ["хемингуэй", "короче и жёстче"],
      "Правка прозы: короткие предложения, конкретные глаголы, без украшений.",
      [
        "Убрать наречия и вводные",
        "Разбить длинные предложения",
        "Оставить действие и диалог",
      ],
      "rewrite_section",
    ),
  },
  {
    key: "cover-generator",
    name: "Генератор обложек",
    description: "Обложки книг и треков под вашу серию работ",
    version: "1.0",
    source: "store",
    icon: "ImagePlus",
    rating: 4.9,
    reviews: 356,
    triggers: ["обложка", "cover art"],
    skillMd: md(
      "Генератор обложек",
      ["обложка", "cover art"],
      "Обложки книг, EP и фильмов в единой серии.",
      [
        "Собрать визуальный якорь из названия",
        "Задать формат (книга / квадрат трека)",
        "Сгенерировать 3 варианта",
      ],
      "generate_image",
    ),
  },
  {
    key: "trailer-sound",
    name: "Саунд-дизайнер трейлеров",
    description: "Интро, аутро и ударные акценты для трейлеров",
    version: "1.0",
    source: "store",
    icon: "AudioLines",
    rating: 4.6,
    reviews: 98,
    triggers: ["саунд трейлера", "интро"],
    skillMd: md(
      "Саунд-дизайнер трейлеров",
      ["саунд трейлера", "интро"],
      "Короткие звуковые акценты под трейлер или клип.",
      [
        "Определить длительность",
        "Подобрать удар и хвост",
        "Озвучить TTS, если нужен голос",
      ],
      "tts_narration",
    ),
  },
  {
    key: "author-time",
    name: "Тайм-менеджмент автора",
    description: "Планирует спринты письма и держит дедлайны",
    version: "1.1",
    source: "store",
    icon: "Timer",
    rating: 4.4,
    reviews: 121,
    triggers: ["план письма", "спринт"],
    skillMd: md(
      "Тайм-менеджмент автора",
      ["план письма", "спринт"],
      "Разбить рукопись на спринты и конкретные шаги плана.",
      [
        "Оценить оставшийся объём",
        "Разбить на 3–8 шагов",
        "Предложить ежедневную норму",
      ],
      "create_note",
    ),
  },
  {
    key: "translator-12",
    name: "Переводчик на 12 языков",
    description: "Художественный перевод с сохранением метафор",
    version: "1.0",
    source: "store",
    icon: "Languages",
    rating: 4.7,
    reviews: 189,
    triggers: ["переведи главу", "translate"],
    skillMd: md(
      "Переводчик на 12 языков",
      ["переведи главу", "translate"],
      "Художественный перевод главы с сохранением метафор и ритма.",
      [
        "Уточнить целевой язык",
        "Перевести, сохраняя образы",
        "Вернуть полный текст главы",
      ],
      "rewrite_section",
    ),
  },
];

export const ALL_CATALOG: SkillCatalogItem[] = [
  ...BUILTIN_SKILLS,
  ...STORE_SKILLS,
];

export function catalogByKey(key: string): SkillCatalogItem | undefined {
  return ALL_CATALOG.find((s) => s.key === key);
}
