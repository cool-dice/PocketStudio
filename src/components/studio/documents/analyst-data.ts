import type { EntityDomain } from "./entities-data";

/**
 * Мок-данные вкладки «Аналитик»: находки-противоречия, недосказанности
 * и расхождения для двух областей — рукописи «Хроник Долгой Зимы» и
 * документации «Спеки PocketStudio». Чистый визуальный слой.
 */

/* ─────────────────────────── Аналитик ─────────────────────────── */

export type AnalystSeverity = "error" | "warning" | "note";
export type AnalystFindingType = "contradiction" | "gap" | "mismatch";

export const ANALYST_TYPE_META: Record<
  AnalystFindingType,
  { label: string; plural: string; badgeClassName: string }
> = {
  contradiction: {
    label: "Противоречие",
    plural: "Противоречия",
    badgeClassName: "border-destructive/50 bg-destructive/10 text-destructive",
  },
  gap: {
    label: "Недосказанность",
    plural: "Недосказанности",
    badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  mismatch: {
    label: "Расхождение",
    plural: "Расхождения",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export const ANALYST_SEVERITY_META: Record<
  AnalystSeverity,
  { label: string; badgeClassName: string }
> = {
  error: {
    label: "Ошибка",
    badgeClassName: "border-destructive/50 bg-destructive/10 text-destructive",
  },
  warning: {
    label: "Предупреждение",
    badgeClassName: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  note: {
    label: "Заметка",
    badgeClassName: "border-border bg-muted text-muted-foreground",
  },
};

export interface AnalystFinding {
  id: string;
  domain: EntityDomain;
  type: AnalystFindingType;
  severity: AnalystSeverity;
  message: string;
  source: string;
  quote: string;
  hint: string;
}

export const ANALYST_FINDINGS: AnalystFinding[] = [
  /* ── Рукопись: «Хроники Долгой Зимы» ── */
  {
    id: "an-1",
    domain: "narrative",
    type: "contradiction",
    severity: "error",
    message: "В главе 2 глаза Ари были зелёными, в главе 7 — карими.",
    source: "гл. 2 · гл. 7",
    quote:
      "«…Вейра смотрит в глаза сестре — карие, как у матери, только теплее…» — глава 7, сцена у маяка.",
    hint: "Зафиксируйте цвет глаз в карточке персонажа, чтобы ИИ не путался дальше.",
  },
  {
    id: "an-2",
    domain: "narrative",
    type: "contradiction",
    severity: "error",
    message: "Стеклянный компас разбит в главе 3, но в главе 6 появляется целым.",
    source: "гл. 3 · гл. 6",
    quote: "«Ари достала компас — стрелка дрожала в трещине…» — глава 6, Исход.",
    hint: "Либо вставьте сцену починки у Хранителей, либо замените предмет в главе 6.",
  },
  {
    id: "an-3",
    domain: "narrative",
    type: "mismatch",
    severity: "warning",
    message: "Возраст Вейры: в главе 2 — 23 года, в главе 9 — 19.",
    source: "гл. 2 · гл. 9",
    quote: "«Девятнадцать зим носила она узелок на запястье…» — глава 9, финал Исхода.",
    hint: "Похоже на опечатку — в таймлайне персонажа указан возраст 23.",
  },
  {
    id: "an-4",
    domain: "narrative",
    type: "mismatch",
    severity: "warning",
    message: "Мост назван «Слюдяным» в главе 4 и «Стеклянным» в главе 6.",
    source: "гл. 4 · гл. 6",
    quote: "«Стеклянный мост пел под полозьями…» — глава 6, переправа.",
    hint: "Сверьте название локации с кодексом: в карточке — «Слюдяной мост».",
  },
  {
    id: "an-5",
    domain: "narrative",
    type: "mismatch",
    severity: "note",
    message: "Имя трактирщицы пишется по-разному: «Стефа» (гл. 2) и «Стефания» (гл. 8).",
    source: "гл. 2 · гл. 8",
    quote: "«Тётушка Стефания выставила всех за дверь…» — глава 8, трактир «Полынья».",
    hint: "Мелочь, но в аудиоверсии это прозвучит как два разных персонажа.",
  },
  /* ── Документация: «Спека PocketStudio» ── */
  {
    id: "ap-1",
    domain: "product",
    type: "contradiction",
    severity: "error",
    message:
      "FR-12 разрешает «Редактору» экспорт в EPUB, а матрица ролей в SRS-3 отдаёт экспорт только «Издателю».",
    source: "SRS-4 · FR-12",
    quote:
      "«Экспорт книги в EPUB доступен ролям Автор, Редактор и Издатель» — FR-12; в таблице прав SRS-3 экспорт только у Издателя.",
    hint: "Сведите права в одну матрицу: у требования и таблицы должна быть единая точка правды.",
  },
  {
    id: "ap-2",
    domain: "product",
    type: "gap",
    severity: "warning",
    message:
      "Для модуля «Каталогизация» не описана обработка ошибок: в SRS-4.2 нет поведения при сбое импорта.",
    source: "SRS-4.2",
    quote:
      "«Импорт принимает файлы Markdown и DOCX…» — раздел обрывается списком форматов, без ошибок и повторов.",
    hint: "Дополните раздел: коды ошибок, поведение очереди, уведомление пользователя.",
  },
  {
    id: "ap-3",
    domain: "product",
    type: "gap",
    severity: "warning",
    message: "Требование FR-07 «Поиск по тегам» не покрыто ни одним сценарием пользователя в SRS-5.",
    source: "FR-07 · SRS-5",
    quote: "Сценарии покрывают создание и публикацию, но не поиск.",
    hint: "Добавьте сценарий «Марина находит черновик по тегу #фэнтези» — иначе требование повиснет.",
  },
  {
    id: "ap-4",
    domain: "product",
    type: "mismatch",
    severity: "error",
    message: "Одни и те же объекты зовутся «записи» (спека), «карточки» (гайд) и «сущности» (чат).",
    source: "SRS-2 · Гайд",
    quote:
      "«Пользователь управляет записями воркспейса…» — SRS-2; в гайде те же объекты названы «карточками».",
    hint: "Выберите один термин («сущности») и прогоните замену по всем документам.",
  },
  {
    id: "ap-5",
    domain: "product",
    type: "mismatch",
    severity: "note",
    message: "Роль «Аналитик» в SRS-3 имеет права только на чтение, а FR-19 даёт ей редактирование сущностей.",
    source: "SRS-3 · FR-19",
    quote: "«Аналитик: просмотр без изменений» — SRS-3; «может предлагать правки сущностей» — FR-19.",
    hint: "Уточните: «предлагать правки» — это чтение с комментариями или полноценная правка?",
  },
];
