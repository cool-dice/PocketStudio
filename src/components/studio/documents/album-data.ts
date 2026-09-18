import { GRADIENTS } from "./narrative-data";

/**
 * Мок-данные альбома NarrativeCore: сгенерированные портреты
 * и иллюстрации, привязанные к сущностям романа.
 * Чистый визуальный слой без запросов.
 */

/* ─────────────────────────── Альбом ─────────────────────────── */

export type AlbumItemKind = "portrait" | "illustration" | "concept";

export const ALBUM_KIND_META: Record<
  AlbumItemKind,
  { label: string; plural: string }
> = {
  portrait: { label: "Портрет", plural: "Портреты" },
  illustration: { label: "Иллюстрация", plural: "Иллюстрации" },
  concept: { label: "Концепт", plural: "Концепты" },
};

export interface AlbumItem {
  id: string;
  kind: AlbumItemKind;
  title: string;
  /** id сущности: персонаж или запись кодекса. */
  entityId: string;
  entityName: string;
  /** true, если сущность — персонаж (для «Открыть персонажа»). */
  isCharacter: boolean;
  gradient: string;
  description: string;
  createdAtAgo: number;
  /** Мок-пометка сгенерированного в этой сессии. */
  isGenerated?: boolean;
}

export const ALBUM_ITEMS: AlbumItem[] = [
  {
    id: "al-ari-1",
    kind: "portrait",
    title: "Ари — охотница за теплом",
    entityId: "ari",
    entityName: "Ари",
    isCharacter: true,
    gradient: GRADIENTS[0],
    description:
      "Портрет для обложки первой части: Ари в капюшоне из оленьей шкуры, за спиной — зарево маяка. Просила «сделать взгляд потише».",
    createdAtAgo: 36,
  },
  {
    id: "al-markel-1",
    kind: "portrait",
    title: "Маркел за картой Исхода",
    entityId: "markel",
    entityName: "Маркел",
    isCharacter: true,
    gradient: GRADIENTS[1],
    description:
      "Старик склонился над столом, керн в руке отсвечивает железом. Свет — от очага слева, тень от карт — на всю стену.",
    createdAtAgo: 96,
  },
  {
    id: "al-veyra-1",
    kind: "portrait",
    title: "Вейра за станком",
    entityId: "veyra",
    entityName: "Вейра",
    isCharacter: true,
    gradient: GRADIENTS[2],
    description:
      "Портрет для главы 6: Вейра вплетает травы в полосу сна. На запястье — узелок на память о сестре.",
    createdAtAgo: 210,
  },
  {
    id: "al-kir-1",
    kind: "portrait",
    title: "Дозорный Кир у книги",
    entityId: "kir",
    entityName: "Дозорный Кир",
    isCharacter: true,
    gradient: GRADIENTS[3],
    description:
      "Антагонист для промо-материалов: Кир со снежным колесом на воротнике, Железная книга тянется цепью к поясу.",
    createdAtAgo: 58,
  },
  {
    id: "al-pristan-1",
    kind: "illustration",
    title: "Тихая Пристань под снегом",
    entityId: "tihaya-pristan",
    entityName: "Тихая Пристань",
    isCharacter: false,
    gradient: GRADIENTS[7],
    description:
      "Панорама порта для разворота: полынья у маяка, корабли вмёрзли в лёд, над крышами — пар от очагов.",
    createdAtAgo: 120,
  },
  {
    id: "al-most-1",
    kind: "illustration",
    title: "Слюдяной мост в сумерках",
    entityId: "slyudyanoy-most",
    entityName: "Слюдяной мост",
    isCharacter: false,
    gradient: GRADIENTS[4],
    description:
      "Иллюстрация к главе 4: сквозь прозрачный лёд моста видна чёрная вода. Караульная башня — сплошной силуэт.",
    createdAtAgo: 30,
  },
  {
    id: "al-noch-1",
    kind: "illustration",
    title: "Ночь без огней",
    entityId: "noch-bez-ogney",
    entityName: "Ночь без огней",
    isCharacter: false,
    gradient: GRADIENTS[6],
    description:
      "Пролог-иллюстрация: погасшие очаги девяти родов, снег идёт вертикально, единственный свет — за горизонтом, у будущего маяка.",
    createdAtAgo: 180,
  },
  {
    id: "al-kompas-1",
    kind: "concept",
    title: "Стеклянный компас — концепт",
    entityId: "steklyannyi-kompas",
    entityName: "Стеклянный компас",
    isCharacter: false,
    gradient: GRADIENTS[5],
    description:
      "Разворот концепта: оправа из китовой кости, трещина через циферблат, стрелка из тёмного железа тянется к краю кадра.",
    createdAtAgo: 16,
  },
];

