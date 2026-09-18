import type { LucideIcon } from "lucide-react";
import {
  Crown,
  Flag,
  Gem,
  Handshake,
  History,
  ScrollText,
  Swords,
  Users,
} from "lucide-react";

import { GRADIENTS } from "./narrative-data";

/**
 * Мок-данные персонажей романа «Хроники Долгой Зимы»: карточки,
 * связи (родство/союз/конфликт) и состояния по главам.
 * Чистый визуальный слой без запросов.
 */

export type CharacterRoleCategory = "main" | "secondary" | "antagonist";

export const CHARACTER_ROLE_META: Record<
  CharacterRoleCategory,
  { label: string; plural: string; single: string }
> = {
  main: { label: "Главные", plural: "Главные", single: "Главный герой" },
  secondary: { label: "Второстепенные", plural: "Второстепенные", single: "Второстепенный герой" },
  antagonist: { label: "Антагонисты", plural: "Антагонисты", single: "Антагонист" },
};

export type RelationKind = "kin" | "ally" | "conflict";

export const RELATION_META: Record<RelationKind, { label: string; icon: LucideIcon }> = {
  kin: { label: "Родство", icon: Users },
  ally: { label: "Союз", icon: Handshake },
  conflict: { label: "Конфликт", icon: Swords },
};

/** Состояние персонажа на конкретной главе — узел таймлайна. */
export interface CharacterState {
  chapter: number;
  age: number;
  status: string;
  location: string;
  note: string;
}

export interface CharacterRelation {
  kind: RelationKind;
  targetId: string;
  note: string;
}

export interface StoryCharacter {
  id: string;
  name: string;
  role: string;
  roleCategory: CharacterRoleCategory;
  age: number;
  short: string;
  biography: string;
  traits: string[];
  relations: CharacterRelation[];
  states: CharacterState[];
  chapters: number[];
  initials: string;
  portraitGradient: string;
  portraitIcon: LucideIcon;
  updatedAgo: number;
}

export const STORY_CHARACTERS: StoryCharacter[] = [
  {
    id: "ari",
    name: "Ари",
    role: "Охотница за теплом, изгнанница рода",
    roleCategory: "main",
    age: 17,
    short: "Семнадцатилетняя дочь снегоходчика, слышит лёд.",
    biography:
      "Родилась в год тридцать четвёртой зимы в роду Снежного колеса. В двенадцать потеряла мать в буране, который «позвал» чей-то крик, — с тех пор не повышает голос даже во сне. Изгнана из рода за третье нарушение Правила тишины: кричала, вытаскивая брата из полыньи. Мечтает вернуть роду Стеклянный компас и место у очага.",
    traits: ["упрямая", "слышит лёд", "боится высоты", "считает шаги", "верит в карты"],
    relations: [
      { kind: "kin", targetId: "veyra", note: "Старшая сестра, единственная родня" },
      { kind: "ally", targetId: "markel", note: "Наставник по картам и молчанию" },
      { kind: "conflict", targetId: "kir", note: "Дозорный, что вёл её дело" },
    ],
    states: [
      { chapter: 1, age: 17, status: "В изгнании", location: "Долгая Зима", note: "Живёт в снежной землянке за стеной" },
      { chapter: 4, age: 17, status: "В бегах", location: "Слюдяной мост", note: "Ищет способ вернуть компас" },
      { chapter: 7, age: 17, status: "Посвящённая", location: "Тихая Пристань", note: "Принята Хранителями в ученицы" },
      { chapter: 9, age: 18, status: "Хранительница тепла", location: "Тихая Пристань", note: "Ведёт род обратно на старые земли" },
    ],
    chapters: [1, 2, 3, 4, 6, 7, 9],
    initials: "А",
    portraitGradient: GRADIENTS[0],
    portraitIcon: Crown,
    updatedAgo: 4,
  },
  {
    id: "markel",
    name: "Маркел",
    role: "Старый картограф Долгой Зимы",
    roleCategory: "secondary",
    age: 64,
    short: "Картограф, что помнит время до Стужения.",
    biography:
      "Единственный, кто ходил по краю до Ночи без огней и после неё. Ведёт Исход девяти родов, за что получил от Дозора железную бирку «первого голоса» — единственного разрешённого крика. С тех пор молчит по-настоящему: бережёт свой крик. Хранит у себя утерянный компас рода Ари и ждёт того, кому его вернуть.",
    traits: ["коллекционер карт", "не спит ночами", "говорит притчами", "бережёт крик"],
    relations: [
      { kind: "ally", targetId: "ari", note: "Ученица, наследница компаса" },
      { kind: "ally", targetId: "veyra", note: "Долг перед её родом" },
      { kind: "conflict", targetId: "kir", note: "Старый счёт за Исход" },
    ],
    states: [
      { chapter: 1, age: 63, status: "Отшельник", location: "Тихая Пристань", note: "Живёт при лавке картографа" },
      { chapter: 5, age: 64, status: "Пропал без вести", location: "—", note: "Ушёл в буран за компасом" },
      { chapter: 8, age: 64, status: "Возвращённый", location: "Тихая Пристань", note: "Найден Хранителями у маяка" },
    ],
    chapters: [1, 3, 5, 7, 8],
    initials: "М",
    portraitGradient: GRADIENTS[1],
    portraitIcon: History,
    updatedAgo: 26,
  },
  {
    id: "veyra",
    name: "Вейра",
    role: "Ткачиха снов, старшая сестра Ари",
    roleCategory: "secondary",
    age: 23,
    short: "Сестра Ари, ткёт сны для торговцев югом.",
    biography:
      "Старшая из двоих детей снегоходчика. После изгнания Ари осталась при роде, чтобы «держать очаг за двоих». Ткёт так называемые сны — полосы ткани, в которые вплетают успокоительные травы; юг платит за них солью. Втайне копит соль на выкуп сестры из изгнания, не зная, что выкупа не существует.",
    traits: ["терпеливая", "вяжет узлы на память", "не умеет врать", "боится воды"],
    relations: [
      { kind: "kin", targetId: "ari", note: "Младшая сестра, изгнана" },
      { kind: "ally", targetId: "stefa", note: "Дружба с трактирных времён" },
    ],
    states: [
      { chapter: 2, age: 22, status: "При роде", location: "Долгая Зима", note: "Ткёт сны на продажу" },
      { chapter: 6, age: 23, status: "В Исходе", location: "Слюдяной мост", note: "Ушла искать сестру" },
      { chapter: 9, age: 23, status: "Вместе с Ари", location: "Тихая Пристань", note: "Род воссоединяется" },
    ],
    chapters: [2, 6, 9],
    initials: "В",
    portraitGradient: GRADIENTS[2],
    portraitIcon: Gem,
    updatedAgo: 42,
  },
  {
    id: "kir",
    name: "Дозорный Кир",
    role: "Капитан караула Слюдяного моста",
    roleCategory: "antagonist",
    age: 41,
    short: "Капитан Дозора, ведёт дело Ари.",
    biography:
      "Сын керна — того, кто выбивает буквы в Железную книгу. Верит, что порядок важнее жалости: каждую запись книги знает наизусть и ни разу не пожалел о приговоре. Вёл дело Ари и добился изгнания; компас рода считает «бесхозным имуществом Дозора». Сломлен не силой, а молчанием — не выносит, когда с ним перестают говорить.",
    traits: ["педант", "помнит приговоры", "не терпит лишних слов", "боится забыть"],
    relations: [
      { kind: "conflict", targetId: "ari", note: "Её дело — его лучшая запись" },
      { kind: "conflict", targetId: "markel", note: "Считает его совратившим роды" },
    ],
    states: [
      { chapter: 4, age: 41, status: "Начальник караула", location: "Слюдяной мост", note: "Задерживает Ари у моста" },
      { chapter: 7, age: 41, status: "Разжалован", location: "Тихая Пристань", note: "Уличён в порче страницы книги" },
      { chapter: 9, age: 41, status: "В изгнании", location: "Долгая Зима", note: "Нарушает Правило тишины в финале" },
    ],
    chapters: [4, 7, 9],
    initials: "К",
    portraitGradient: GRADIENTS[3],
    portraitIcon: Swords,
    updatedAgo: 18,
  },
  {
    id: "stefa",
    name: "Стефа",
    role: "Трактирщица «Полыньи»",
    roleCategory: "secondary",
    age: 34,
    short: "Держит трактир у маяка, всё слышит и молчит.",
    biography:
      "Родилась на пристани и ни разу не выходила за её черту. Держит трактир «Полынья» — место, где Дозор и Хранители пьют за разными столами, но из одного самовара. Единственная в городе умеет читать по губам — потому её трактир стал главной «слуховой» точкой романа. Информацию отдаёт за истории, а истории потом вплетает в меню.",
    traits: ["смешливая", "читает по губам", "собирает истории", "варит правильный грог"],
    relations: [
      { kind: "ally", targetId: "veyra", note: "Дружба с трактирных времён" },
      { kind: "ally", targetId: "ari", note: "Прячет её от караула" },
    ],
    states: [
      { chapter: 2, age: 34, status: "Трактирщица", location: "Тихая Пристань", note: "Знакомится с Ари" },
      { chapter: 7, age: 34, status: "Свидетель", location: "Тихая Пристань", note: "Даёт показания против Кира" },
    ],
    chapters: [2, 7, 8],
    initials: "С",
    portraitGradient: GRADIENTS[4],
    portraitIcon: Flag,
    updatedAgo: 70,
  },
  {
    id: "olm",
    name: "Хранитель Ольм",
    role: "Голос очага, глава Хранителей Тепла",
    roleCategory: "secondary",
    age: 71,
    short: "Глава ордена, говорит раз в день.",
    biography:
      "Сорок лет поддерживает маяк-очаг и ни разу не вышел за черту города. По уставу Хранителей Ольм имеет право на одну фразу в день — «голос очага» — и тратит её не экономно, а точно. Принял Ари в ученицы вопреки Дозору: увидел в её молчании «правильную тишину».",
    traits: ["немногословный", "терпеливый", "видит насквозь", "любит шахматы"],
    relations: [
      { kind: "ally", targetId: "ari", note: "Ученица очага" },
      { kind: "ally", targetId: "markel", note: "Сорок лет переписки знаками" },
    ],
    states: [
      { chapter: 5, age: 70, status: "Хранитель очага", location: "Тихая Пристань", note: "Находит Маркела в буране" },
      { chapter: 7, age: 71, status: "Глава ордена", location: "Тихая Пристань", note: "Принимает Ари в ученицы" },
    ],
    chapters: [5, 7, 8, 9],
    initials: "О",
    portraitGradient: GRADIENTS[5],
    portraitIcon: ScrollText,
    updatedAgo: 130,
  },
];

export function getCharacter(id: string): StoryCharacter | undefined {
  return STORY_CHARACTERS.find((character) => character.id === id);
}
