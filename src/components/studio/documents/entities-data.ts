import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Boxes,
  FileText,
  Flag,
  Gem,
  History,
  KeyRound,
  ListChecks,
  MapPin,
  Plug,
  ScrollText,
  UserRound,
  Users,
} from "lucide-react";

import { CHARACTER_ROLE_META, STORY_CHARACTERS } from "./character-data";
import { GENERATED_LORE_TEMPLATES, LORE_ENTITIES, ageLabel, type LoreCategory } from "./narrative-data";

/**
 * Универсальная модель сущностей модуля «Документы»: один каталог
 * записей для художественного текста и для документации. Виды —
 * от персонажей и лора мира до пользователей, ролей и требований —
 * меняются под задачу, а карточка и панель остаются общими.
 */

/* ─────────────────────────── Модель ─────────────────────────── */

export type EntityDomain = "narrative" | "product";

export type EntityKind =
  | "character"
  | "location"
  | "event"
  | "item"
  | "faction"
  | "rule"
  | "user"
  | "role"
  | "requirement"
  | "module"
  | "integration";

export interface StudioEntity {
  id: string;
  kind: EntityKind;
  name: string;
  short: string;
  description: string;
  attributes: { label: string; value: string }[];
  tags: string[];
  /** id других сущностей того же набора. */
  related: string[];
  /** Упоминания: «гл. 2, 7» или «SRS-3, FR-12». */
  refs: { kind: "chapter" | "section"; items: string[] };
  updatedAgo: number;
  /** Только персонажи: градиент-портрет и инициалы. */
  portrait?: { gradient: string; initials: string };
}

export interface EntitySet {
  id: string;
  label: string;
  hint: string;
  domain: EntityDomain;
  icon: LucideIcon;
  entities: StudioEntity[];
}

export const ENTITY_KIND_META: Record<
  EntityKind,
  { label: string; plural: string; icon: LucideIcon }
> = {
  character: { label: "Персонаж", plural: "Персонажи", icon: Users },
  location: { label: "Локация", plural: "Локации", icon: MapPin },
  event: { label: "Событие", plural: "События", icon: History },
  item: { label: "Предмет", plural: "Предметы", icon: Gem },
  faction: { label: "Фракция", plural: "Фракции", icon: Flag },
  rule: { label: "Правило", plural: "Правила", icon: ScrollText },
  user: { label: "Пользователь", plural: "Пользователи", icon: UserRound },
  role: { label: "Роль", plural: "Роли", icon: KeyRound },
  requirement: { label: "Требование", plural: "Требования", icon: ListChecks },
  module: { label: "Модуль", plural: "Модули", icon: Boxes },
  integration: { label: "Интеграция", plural: "Интеграции", icon: Plug },
};

/* ───────── Набор «Хроники Долгой Зимы»: из лора и персонажей ───────── */

const LORE_KIND_BY_CATEGORY: Record<LoreCategory, EntityKind> = {
  location: "location",
  event: "event",
  item: "item",
  faction: "faction",
  rule: "rule",
};

const khronikiIds = new Set<string>([
  ...LORE_ENTITIES.map((entity) => entity.id),
  ...STORY_CHARACTERS.map((character) => character.id),
]);

const NARRATIVE_CHARACTER_ENTITIES: StudioEntity[] = STORY_CHARACTERS.map((character) => ({
  id: character.id,
  kind: "character",
  name: character.name,
  short: character.short,
  description: character.biography,
  attributes: [
    { label: "Роль в романе", value: character.role },
    { label: "Возраст", value: ageLabel(character.age) },
    { label: "Категория", value: CHARACTER_ROLE_META[character.roleCategory].single },
    { label: "Появлений", value: `${character.chapters.length} глав` },
  ],
  tags: character.traits,
  related: character.relations
    .map((relation) => relation.targetId)
    .filter((id) => khronikiIds.has(id)),
  refs: { kind: "chapter", items: character.chapters.map((chapter) => String(chapter)) },
  updatedAgo: character.updatedAgo,
  portrait: { gradient: character.portraitGradient, initials: character.initials },
}));

const NARRATIVE_LORE_ENTITIES: StudioEntity[] = LORE_ENTITIES.map((entity) => ({
  id: entity.id,
  kind: LORE_KIND_BY_CATEGORY[entity.category],
  name: entity.name,
  short: entity.short,
  description: entity.description,
  attributes: entity.attributes,
  tags: entity.tags,
  related: entity.related.filter((id) => khronikiIds.has(id)),
  refs: { kind: "chapter", items: entity.chapters.map((chapter) => String(chapter)) },
  updatedAgo: entity.updatedAgo,
}));

/* ───────── Набор «Спека PocketStudio»: документация ───────── */

const SPEC_ENTITIES: StudioEntity[] = [
  {
    id: "u-marina",
    kind: "user",
    name: "Марина — автор-новичок",
    short: "Пишет первую книгу, боится редактора",
    description:
      "Основной портрет целевой аудитории: пишет фэнтези-роман по вечерам после работы. Заметки держит в пяти разных местах и от этого теряет связность сюжета. Боится показывать черновики «настоящему редактору» — студия должна стать мягким мостом к публикации.",
    attributes: [
      { label: "Цель", value: "Довести роман до публикации" },
      { label: "Опыт", value: "Первая книга" },
      { label: "Боли", value: "Теряет заметки, путается в героях" },
    ],
    tags: ["портрет ЦА", "начинающий"],
    related: ["role-author", "fr-07"],
    refs: { kind: "section", items: ["SRS-2", "SRS-3"] },
    updatedAgo: 22,
  },
  {
    id: "u-timur",
    kind: "user",
    name: "Тимур — продюсер подкаста",
    short: "Собирает выпуски: скрипт, озвучка, обложка",
    description:
      "Второй портрет аудитории: ведёт еженедельный подкаст в одиночку. Каждый выпуск — скрипт, озвучка и обложка, разложенные по трём разным сервисам. Приходит в студию за тем, чтобы конвейер выпуска умещался в один вечер.",
    attributes: [
      { label: "Цель", value: "Выпуск в неделю без монтажской" },
      { label: "Опыт", value: "3 года подкастов" },
      { label: "Боли", value: "Разрозненные файлы и правки" },
    ],
    tags: ["портрет ЦА", "подкаст"],
    related: ["mod-chat", "int-store"],
    refs: { kind: "section", items: ["SRS-2"] },
    updatedAgo: 47,
  },
  {
    id: "role-author",
    kind: "role",
    name: "Автор",
    short: "Создаёт воркспейсы и публикует свои тексты",
    description:
      "Базовая роль: выдаётся при регистрации и открывает создание воркспейсов. Автор владеет своими текстами и публикует их без чужого одобрения. Всё, что выходит за рамки собственных материалов, требует ролей Редактора или Издателя.",
    attributes: [
      { label: "Права", value: "Создание воркспейсов, публикация своих текстов" },
      { label: "Кому выдаётся", value: "Любой пользователь студии" },
    ],
    tags: ["права", "регистрация"],
    related: ["role-publisher"],
    refs: { kind: "section", items: ["SRS-3"] },
    updatedAgo: 130,
  },
  {
    id: "role-editor",
    kind: "role",
    name: "Редактор",
    short: "Правит чужие тексты и сущности без публикации",
    description:
      "Роль для тех, кто дорабатывает материалы автора: правит тексты, сущности и структуру. Публиковать и экспортировать не может — финальное слово за Издателем. Именно вокруг этой роли сейчас спорят из-за FR-12.",
    attributes: [
      { label: "Права", value: "Правка чужих текстов и сущностей, без публикации" },
      { label: "Ограничение", value: "Экспорт — только через Издателя" },
    ],
    tags: ["права", "конфликт FR-12"],
    related: ["fr-12", "role-publisher"],
    refs: { kind: "section", items: ["SRS-3"] },
    updatedAgo: 9,
  },
  {
    id: "role-publisher",
    kind: "role",
    name: "Издатель",
    short: "Публикует, монетизирует и экспортирует",
    description:
      "Финальная роль конвейера: публикует готовые материалы, управляет монетизацией и экспортирует во все форматы. Единственная роль с полным доступом к выкладке. В матрице прав SRS-3 именно за ней закреплён экспорт — с чем и спорит FR-12.",
    attributes: [{ label: "Права", value: "Публикация, монетизация, экспорт во все форматы" }],
    tags: ["права", "экспорт"],
    related: ["fr-12"],
    refs: { kind: "section", items: ["SRS-3"] },
    updatedAgo: 65,
  },
  {
    id: "fr-07",
    kind: "requirement",
    name: "FR-07 · Поиск по тегам",
    short: "Найти черновик по тегу, не помня названия",
    description:
      "Пользователь помнит, о чём был текст, но не помнит, как он назывался: поиск по тегам закрывает этот случай. Требование родилось из интервью с Мариной — она теряет заметки. Не покрыто ни одним сценарием в SRS-5, что уже отметила проверка аналитика.",
    attributes: [
      { label: "Приоритет", value: "Высокий" },
      { label: "Статус", value: "Согласовано" },
      { label: "Источник", value: "Интервью с Мариной" },
    ],
    tags: ["поиск", "высокий приоритет"],
    related: ["u-marina", "mod-docs"],
    refs: { kind: "section", items: ["SRS-3"] },
    updatedAgo: 12,
  },
  {
    id: "fr-12",
    kind: "requirement",
    name: "FR-12 · Экспорт в EPUB",
    short: "Экспорт книги в EPUB — статус спорный",
    description:
      "Экспорт готовой книги в EPUB для площадок и читалок. Текст требования разрешает экспорт Автору, Редактору и Издателю, а таблица прав в SRS-3 отдаёт экспорт только Издателю. Статус «спорно» держится именно на этом расхождении.",
    attributes: [
      { label: "Приоритет", value: "Средний" },
      { label: "Статус", value: "Спорно — конфликт ролей" },
      { label: "Источник", value: "Гайд по релизу" },
    ],
    tags: ["экспорт", "конфликт"],
    related: ["role-editor", "role-publisher"],
    refs: { kind: "section", items: ["SRS-3", "SRS-4"] },
    updatedAgo: 3,
  },
  {
    id: "fr-19",
    kind: "requirement",
    name: "FR-19 · Редактирование сущностей",
    short: "Правка записей руками, не только чатом",
    description:
      "Возможность править сущности вручную: атрибуты, теги и связи. Сейчас карточки только читаются, а меняются через чат-оркестратор. Требование в черновике и конфликтует с правами роли «Аналитик» — это уже отмечено в проверке документации.",
    attributes: [
      { label: "Приоритет", value: "Низкий" },
      { label: "Статус", value: "Черновик" },
    ],
    tags: ["сущности", "черновик"],
    related: ["role-editor", "mod-docs"],
    refs: { kind: "section", items: ["SRS-4", "SRS-5"] },
    updatedAgo: 84,
  },
  {
    id: "mod-chat",
    kind: "module",
    name: "Чат-оркестратор",
    short: "Главный инструмент студии: диалог и действия",
    description:
      "Ядро продукта: собеседник, который умеет вызывать инструменты модулей. Держит контекст воркспейса и треды обсуждений. Зависит от LLM-шлюза и системы тредов — без них не собирается.",
    attributes: [
      { label: "Статус", value: "В разработке" },
      { label: "Зависимости", value: "LLM-шлюз, треды" },
    ],
    tags: ["ядро", "чат"],
    related: ["mod-docs"],
    refs: { kind: "section", items: ["SRS-4.1"] },
    updatedAgo: 7,
  },
  {
    id: "mod-docs",
    kind: "module",
    name: "Документы",
    short: "Рукопись, сущности, альбом и аналитик",
    description:
      "Модуль работы с текстами: редактор рукописи, универсальные сущности, альбом артов и аналитик-ревьюер. Именно здесь живут требования FR-07 и FR-19. Зависит от хранилища воркспейсов.",
    attributes: [
      { label: "Статус", value: "В разработке" },
      { label: "Зависимости", value: "Хранилище воркспейсов" },
    ],
    tags: ["тексты", "сущности"],
    related: ["fr-07", "fr-19"],
    refs: { kind: "section", items: ["SRS-4.2"] },
    updatedAgo: 18,
  },
  {
    id: "mod-catalog",
    kind: "module",
    name: "Каталогизация",
    short: "Библиотека артефактов по всем воркспейсам",
    description:
      "Единая библиотека: артефакты всех воркспейсов с фильтрами и поиском. Статус «не начат» — есть только эскизы интерфейса. Для импорта не описана обработка ошибок, что уже попало в отчёт аналитика.",
    attributes: [
      { label: "Статус", value: "Не начат" },
      { label: "Зависимости", value: "Библиотека" },
    ],
    tags: ["каталог", "импорт"],
    related: ["fr-07"],
    refs: { kind: "section", items: ["SRS-4.2"] },
    updatedAgo: 140,
  },
  {
    id: "int-store",
    kind: "integration",
    name: "Магазин навыков",
    short: "Внешний API расширений для студии",
    description:
      "Интеграция с внешним магазином навыков: установка скиллов прямо в студию. Пока идея без протокола — не решено, как проверять совместимость версий. Интересна продюсерам вроде Тимура: сборка конвейера из готовых блоков.",
    attributes: [
      { label: "Тип", value: "Внешний API" },
      { label: "Статус", value: "Идея" },
    ],
    tags: ["расширения", "идея"],
    related: ["u-timur"],
    refs: { kind: "section", items: ["SRS-6"] },
    updatedAgo: 220,
  },
];

/* ─────────────────────────── Наборы ─────────────────────────── */

export const ENTITY_SETS: EntitySet[] = [
  {
    id: "khroniki",
    label: "Хроники Долгой Зимы",
    hint: "роман · художественный текст",
    domain: "narrative",
    icon: BookOpenText,
    entities: [...NARRATIVE_CHARACTER_ENTITIES, ...NARRATIVE_LORE_ENTITIES],
  },
  {
    id: "spec-pocketstudio",
    label: "Спека PocketStudio",
    hint: "документация · SRS, роли и требования",
    domain: "product",
    icon: FileText,
    entities: SPEC_ENTITIES,
  },
];

/* ─────────────────────────── Шаблоны генерации ─────────────────────────── */

/** Мок-абзац «Сгенерировать описание» для вида сущности. */
export const GENERATED_ENTITY_TEMPLATES: Record<EntityKind, string> = {
  character:
    "Таким людям не пишут биографий — их пересказывают. В каждом пересказе меняются детали, но не жест: то, что человек делает в тишине, когда думает, что его не видят. Начните сцену не с лица, а с этого жеста — и персонаж узнается без имени.",
  location: GENERATED_LORE_TEMPLATES.location,
  event: GENERATED_LORE_TEMPLATES.event,
  item: GENERATED_LORE_TEMPLATES.item,
  faction: GENERATED_LORE_TEMPLATES.faction,
  rule: GENERATED_LORE_TEMPLATES.rule,
  user:
    "Портрет стоит углубить: за каждой болью — конкретная ситуация. Что именно теряется в заметках, в какой момент автор путается в героях и что для него «довести книгу до публикации». Хорошая спецификация отвечает на эти вопросы до того, как их задаст разработка.",
  role:
    "Роль описывает не то, что человек делает, а то, что ему разрешено. Уточните, откуда она берётся — вручную администратором или автоматически при регистрации, — и что прямо запрещает: у каждой роли должен быть список недоступных действий, а не «пока не решили». Тогда матрица прав перестанет порождать конфликты.",
  requirement:
    "К сильному требованию приложены критерии приёмки: как проверить, что оно выполнено, и что считать провалом. Пропишите крайние случаи — пустой запрос, тег из тысячи символов, совпадения в трёх языках — и превратите каждый в проверяемый шаг. Если критерии не пишутся, требование ещё не понято.",
  module:
    "У модуля должна быть ясная граница ответственности: что он делает сам, что отдаёт соседям и за что не отвечает вовсе. Опишите входы и выходы как контракты — тогда статус «в разработке» сверяется не по ощущениям, а по списку закрытых точек. Отдельно зафиксируйте, что остаётся за пределами модуля.",
  integration:
    "У внешней интеграции три режима: работает, недоступна, тормозит. Опишите протокол обмена и поведение при каждом сбое — таймаут, невалидный ответ, просроченный токен. Пользователь должен видеть внятное сообщение, а не молчание: режим отказа — часть контракта, а не деталь на потом.",
};

/* ─────────────────────────── Хелперы ─────────────────────────── */

export function getEntitySet(id: string): EntitySet | undefined {
  return ENTITY_SETS.find((set) => set.id === id);
}

/** Уникальные виды набора в порядке следования записей. */
export function kindsOfSet(set: EntitySet): EntityKind[] {
  const kinds: EntityKind[] = [];
  for (const entity of set.entities) {
    if (!kinds.includes(entity.kind)) kinds.push(entity.kind);
  }
  return kinds;
}

export function getEntity(setId: string, id: string): StudioEntity | undefined {
  return getEntitySet(setId)?.entities.find((entity) => entity.id === id);
}
