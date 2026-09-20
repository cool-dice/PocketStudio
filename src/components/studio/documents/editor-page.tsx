"use client";

/**
 * Центральная зона редактора (Фаза A): редактируемый заголовок документа,
 * «страница» главы с авторастущим textarea и нижняя строка живой
 * статистики. Автосохранение — хук useSectionAutosave (дебаунс 800 мс,
 * сериализация запросов, флеш при смене главы/размонтировании).
 */

import { CaseSensitive, Clock3, ListOrdered, Plus, Type } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { displayedSectionsCount } from "@/lib/documents-list";
import { cn } from "@/lib/utils";
import type { DocumentDto, DocumentSectionDto } from "@/lib/workspace-types";
import type { SectionPatch } from "@/hooks/use-documents";
import type { SaveState } from "./editor-toolbar";
import { agoFromISO, charsLabel, docKindMeta, docProgress, formatNumber, wordsLabel } from "./types";

const AUTOSAVE_DELAY_MS = 800;

/* ───────────────────── Хук автосохранения секции ───────────────────── */

export function useSectionAutosave(
  section: DocumentSectionDto | null,
  save: (id: string, patch: SectionPatch) => Promise<DocumentSectionDto | null>,
): {
  draft: string;
  onChange: (value: string) => void;
  saveState: SaveState;
  savedLabel: string;
  flush: () => Promise<DocumentSectionDto | null>;
  replaceDraft: (value: string) => void;
} {
  const [draft, setDraftState] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<number | null>(null);
  /** Несохранённый драфт (сбрасывается после успешного сохранения). */
  const dirtyRef = useRef<{ id: string; content: string } | null>(null);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveRef = useRef(save);
  const sectionRef = useRef(section);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    sectionRef.current = section;
  }, [section]);

  const doSave = useCallback((id: string, content: string) => {
    chainRef.current = chainRef.current.then(async () => {
      // Драфт уже новее — этот вызов устарел, следующий сохранит.
      if (
        dirtyRef.current &&
        (dirtyRef.current.id !== id || dirtyRef.current.content !== content)
      ) {
        return;
      }
      setSaveState("saving");
      try {
        const result = await saveRef.current(id, { content });
        if (
          result &&
          dirtyRef.current?.id === id &&
          dirtyRef.current.content === content
        ) {
          dirtyRef.current = null;
          setSaveState("saved");
          setSavedAt(new Date());
        }
      } catch {
        setSaveState("dirty");
      }
    });
  }, []);

  const onChange = useCallback((value: string) => {
    setDraftState(value);
    const id = sectionRef.current?.id;
    if (!id) return;
    dirtyRef.current = { id, content: value };
    setSaveState("dirty");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      doSave(id, value);
    }, AUTOSAVE_DELAY_MS);
  }, [doSave]);

  // Смена главы: сброс драфта на текст новой главы (во время рендера —
  // каскадных эффектов не будет), флеш несохранённого — в эффекте ниже.
  const sectionId = section?.id ?? null;
  const [prevSectionId, setPrevSectionId] = useState(sectionId);
  if (prevSectionId !== sectionId) {
    setPrevSectionId(sectionId);
    setDraftState(section?.content ?? "");
    setSaveState("idle");
  }
  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = dirtyRef.current;
    if (pending) {
      void doSave(pending.id, pending.content);
    }
    // Только по id: content меняется при сохранении и не должен дёргать драфт.
  }, [sectionId]);

  // Размонтирование: флуш несохранённого текста.
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      const pending = dirtyRef.current;
      if (pending) {
        dirtyRef.current = null;
        void saveRef.current(pending.id, { content: pending.content });
      }
    },
    [],
  );

  const savedLabel = savedAt
    ? `Сохранено · ${savedAt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`
    : "Сохранено";

  const flush = useCallback(async () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = dirtyRef.current;
    if (!pending) return null;
    doSave(pending.id, pending.content);
    await chainRef.current;
    return null;
  }, [doSave]);

  const replaceDraft = useCallback((value: string) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    dirtyRef.current = null;
    setDraftState(value);
    setSaveState("saved");
    setSavedAt(new Date());
  }, []);

  return { draft, onChange, saveState, savedLabel, flush, replaceDraft };
}

/* ───────────────────── Заголовок документа ───────────────────── */

/** Хлебные крошки + редактируемое название (blur/Enter → onRename). */
export function DocumentTitleRow({
  doc,
  onRename,
}: {
  doc: DocumentDto;
  onRename: (title: string) => void;
}) {
  const kind = docKindMeta(doc.kind);
  const Icon = kind.icon;
  const progress = docProgress(doc);

  return (
    <div className="shrink-0 px-4 pb-4 pt-5 sm:px-6">
      <nav
        aria-label="Путь к документу"
        className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        <span className="shrink-0">Библиотека</span>
        <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">/</span>
        <span className="shrink-0">{kind.plural}</span>
        <span className="shrink-0 text-muted-foreground/50" aria-hidden="true">/</span>
        <span className="truncate">{doc.title}</span>
      </nav>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <input
          key={doc.id}
          defaultValue={doc.title}
          aria-label="Название документа"
          onBlur={(event) => {
            const title = event.target.value.trim();
            if (title && title !== doc.title) onRename(title);
            else event.target.value = doc.title;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.currentTarget.value = doc.title;
              event.currentTarget.blur();
            }
          }}
          maxLength={120}
          className={cn(
            "min-w-0 flex-1 rounded-lg bg-transparent px-1.5 py-0.5 text-xl font-semibold tracking-tight outline-none transition-colors",
            "hover:bg-accent focus-visible:bg-accent sm:text-2xl",
          )}
        />
        <BadgePill>
          <Icon className="size-3" aria-hidden="true" />
          {kind.label}
        </BadgePill>
        <BadgePill className="border-primary/30 bg-primary/10 text-primary">
          {formatNumber(displayedSectionsCount(doc))}{" "}
          секц. · {progress}%
        </BadgePill>
      </div>
    </div>
  );
}

function BadgePill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ───────────────────── Страница главы ───────────────────── */

export function EditorPage({
  doc,
  section,
  draft,
  onChange,
  textareaRef,
}: {
  doc: DocumentDto;
  section: DocumentSectionDto | null;
  draft: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const sections = doc.sections ?? [];
  const index = section ? sections.findIndex((s) => s.id === section.id) : -1;
  const eyebrow = section
    ? index >= 0
      ? `Раздел ${index + 1}`
      : "Раздел"
    : docKindMeta(doc.kind).label;

  // Авторастущая высота textarea.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, section?.id, textareaRef]);

  if (!section) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 px-4 py-20 text-center sm:px-6">
        <p className="text-sm font-medium">В документе пока нет разделов</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
          Добавьте первую главу в дереве структуры справа — и начните писать.
        </p>
      </div>
    );
  }

  return (
    <article className="mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:px-6" aria-label="Текст документа">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
        <h3 className="mt-2.5 font-serif text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {section.title}
        </h3>
        <div className="mt-4 h-px w-16 bg-primary/40" aria-hidden="true" />
        <p className="mt-4 text-xs text-muted-foreground">
          {section.status === "done" ? "готово" : "черновик"} · последняя правка{" "}
          {agoFromISO(section.updatedAt)}
        </p>
      </header>

      <label htmlFor="section-text" className="sr-only">
        Текст раздела «{section.title}»
      </label>
      <textarea
        id="section-text"
        ref={textareaRef}
        value={draft}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Начните писать главу — автосохранение сработает через мгновение…"
        autoFocus
        spellCheck
        rows={16}
        className="mt-8 block min-h-[45vh] w-full resize-none rounded-xl bg-transparent font-serif text-[15px] leading-[1.85] text-foreground/90 outline-none placeholder:text-muted-foreground/60 sm:text-base"
      />
    </article>
  );
}

/* ───────────────────── Нижняя статистика ───────────────────── */

export function EditorFooterStats({
  doc,
  section,
  draftWords,
}: {
  doc: DocumentDto;
  section: DocumentSectionDto | null;
  draftWords: number;
}) {
  const words = section ? draftWords : doc.wordsCount;
  const chars = Math.round(words * 6.5);
  const minutes = Math.max(1, Math.round(words / 230));
  const sections = doc.sections ?? [];
  const index = section ? sections.findIndex((s) => s.id === section.id) : -1;

  return (
    <footer className="shrink-0 border-t bg-background/60 px-4 py-2.5 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Type className="size-3.5 shrink-0" aria-hidden="true" />
          {wordsLabel(words)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CaseSensitive className="size-3.5 shrink-0" aria-hidden="true" />
          {charsLabel(Math.round(chars))}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
          {minutes} мин чтения
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-medium text-foreground/70">
          <ListOrdered className="size-3.5 shrink-0" aria-hidden="true" />
          {section && index >= 0
            ? `Раздел ${formatNumber(index + 1)} из ${formatNumber(sections.length)}`
            : docKindMeta(doc.kind).label}
        </span>
      </div>
    </footer>
  );
}

/* ───────────────────── Скелетон и пустые состояния ───────────────────── */

export function EditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-2/3" />
      <div className="space-y-2.5 pt-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-4"
            style={{ width: `${[96, 100, 88, 100, 92, 100, 70][index % 7]}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function NoDocumentsEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span
        className="flex size-12 items-center justify-center rounded-2xl border bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <ListOrdered className="size-6" />
      </span>
      <div>
        <p className="text-sm font-medium">Документов пока нет</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          Создайте первый документ — рукопись, спеку или статью — и начните писать.
        </p>
      </div>
      <Button type="button" size="sm" className="mt-1" onClick={onCreate}>
        <Plus className="size-3.5" aria-hidden="true" />
        Новый документ
      </Button>
    </div>
  );
}
