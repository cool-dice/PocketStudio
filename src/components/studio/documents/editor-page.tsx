"use client";

/**
 * Центральная зона редактора: строка заголовка документа (хлебные крошки,
 * тип и статус), «страница» с книжной типографикой (буквица, цитата,
 * орнамент разрыва) и нижняя строка статистики.
 */

import { CaseSensitive, Clock3, ListOrdered, Type } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  KIND_META,
  STATUS_META,
  charsLabel,
  formatNumber,
  wordsLabel,
  type Chapter,
  type StudioDoc,
} from "./types";

/** Хлебные крошки + крупный заголовок документа с бейджами типа и статуса. */
export function DocumentTitleRow({ doc, chapter }: { doc: StudioDoc; chapter: Chapter | null }) {
  const kind = KIND_META[doc.kind];
  const status = STATUS_META[doc.status];
  const Icon = kind.icon;

  return (
    <div className="shrink-0 px-4 pb-4 pt-5 sm:px-6">
      <nav aria-label="Путь к документу" className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span className="shrink-0">Библиотека</span>
        <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">
          /
        </span>
        <span className="shrink-0">{kind.plural}</span>
        <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">
          /
        </span>
        <span className="truncate">{doc.title}</span>
      </nav>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{doc.title}</h2>
        <Badge variant="outline" className="gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3" aria-hidden="true" />
          {kind.label}
        </Badge>
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
            status.className,
          )}
        >
          {chapter ? `Глава ${chapter.number} · ` : ""}
          {status.label}
        </span>
      </div>
    </div>
  );
}

/** «Страница» рукописи: книжная типографика, буквица, цитата, орнамент разрыва. */
export function EditorPage({ doc, chapter }: { doc: StudioDoc; chapter: Chapter | null }) {
  const eyebrow = chapter ? `Глава ${chapter.number}` : KIND_META[doc.kind].label;
  const heading = chapter ? chapter.title : doc.title;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 pb-20 pt-8 sm:px-6" aria-label="Текст документа">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h3 className="mt-2.5 font-serif text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {heading}
        </h3>
        <div className="mt-4 h-px w-16 bg-primary/40" aria-hidden="true" />
        <p className="mt-4 text-xs text-muted-foreground">черновик · последняя правка сегодня, 12:41</p>
      </header>

      <div className="mt-8 font-serif text-[15px] leading-[1.85] text-foreground/90 sm:text-base">
        <p className="first-letter:float-left first-letter:mr-2.5 first-letter:mt-1.5 first-letter:font-serif first-letter:text-[3.3rem] first-letter:font-semibold first-letter:leading-[0.72] first-letter:text-primary">
          Каждое утро я вынимаю студию из кармана — вместе с ключами, проездным и мятой жвачкой. Ещё год назад
          это звучало бы шуткой: ну какой из телефона павильон? Но однажды в троллейбусе, по дороге на скучную
          встречу, я дописал половину главы, собрал к ней три обложки и набросал раскадровку первой сцены.
          Тогда и понял: шутка перестала быть шуткой — она стала планом работы.
        </p>
        <p className="mt-6">
          Карманная студия устроена как хороший перочинный нож: снаружи — ничего особенного, внутри — целая
          мастерская. Слева полка, где стоят рукописи и заметки; посередине стол, за которым пишутся книги;
          справа маленький экран, где уже вовсю идут съёмки. Всё это хозяйство умещается в шесть дюймов и не
          рвёт швы — ни в джинсах, ни в расписании.
        </p>
        <blockquote className="my-7 border-l-2 border-primary/50 pl-4 sm:pl-5">
          <p className="font-serif text-base italic leading-relaxed text-foreground/80 sm:text-lg">
            «Настоящая свобода — не когда у тебя есть студия. Настоящая свобода — когда студия есть у тебя
            везде, где ты сейчас стоишь».
          </p>
          <cite className="mt-1.5 block font-sans text-xs not-italic text-muted-foreground">
            — из письма к читателям
          </cite>
        </blockquote>
        <p className="mt-6">
          Конечно, у карманной студии есть свои законы. Она не терпит суеты: если распахнуть сразу все
          инструменты, она обижается и подвисает. Она любит, когда с неё сдувают крошки — то есть закрывают
          лишние вкладки. И она удивительно щедра к тому, кто с ней считается: час в метро превращается в
          готовую главу, вечер на кухне — в первый выпуск, а скучная очередь — в лучший в мире кабинет для
          придумывания миров.
        </p>
        <p
          className="my-9 select-none text-center font-serif text-lg tracking-[0.5em] text-muted-foreground"
          aria-hidden="true"
        >
          * * *
        </p>
        <p>
          В этой главе я собрал всё, что узнал о том, как носить с собой целое производство: от черновика на
          салфетке до опубликованной книги. Здесь будут и громкие провалы — куда без них, — и тихие победы, о
          которых не пишут в пресс-релизах. Спойлер один: помещается. И ещё остаётся место для жвачки.
        </p>
      </div>
    </article>
  );
}

/** Нижняя строка статистики редактора: слова, знаки, время чтения, глава. */
export function EditorFooterStats({ doc, chapter }: { doc: StudioDoc; chapter: Chapter | null }) {
  const words = chapter && chapter.words > 0 ? chapter.words : doc.words;
  const chars = Math.round(words * 6.5);
  const minutes = Math.max(1, Math.round(words / 230));
  const chaptersTotal = doc.chapters?.length ?? 0;

  return (
    <footer className="shrink-0 border-t bg-background/60 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Type className="size-3.5 shrink-0" aria-hidden="true" />
          {wordsLabel(words)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CaseSensitive className="size-3.5 shrink-0" aria-hidden="true" />
          {charsLabel(chars)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
          {minutes} мин чтения
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-foreground/70">
          <ListOrdered className="size-3.5 shrink-0" aria-hidden="true" />
          {chapter
            ? `Глава ${formatNumber(chapter.number)} из ${formatNumber(chaptersTotal)}`
            : KIND_META[doc.kind].label}
        </span>
      </div>
    </footer>
  );
}
