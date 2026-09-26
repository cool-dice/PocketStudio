"use client";

/**
 * NotebookScreen — center-zone view (replaces ChatArea while active):
 * sticky header (title + count + quick-capture), horizontally scrollable
 * filter chips (Все / ⭐ Избранные / dynamic categories), NoteCard feed with
 * optimistic favorite/delete, «Загрузить ещё» pagination, skeletons and a
 * friendly empty state.
 */

import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  FolderKanban,
  Loader2,
  ListChecks,
  Menu,
  NotebookPen,
  PenLine,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NotebookStats } from "@/components/app/notebook-stats";
import { NotebookTaxonomyDialog } from "@/components/app/notebook-taxonomy-dialog";
import { useNotes } from "@/hooks/use-notes";
import { formatNoteDate } from "@/lib/format";
import { useAppUi } from "@/lib/store";
import {
  CategoryGlyph,
  categoryColorStyle,
} from "@/lib/category-style";
import {
  NOTEBOOK_EMPTY,
  NOTEBOOK_EMPTY_HINT,
  NOTEBOOK_FILTER_EMPTY,
  NOTEBOOK_FILTER_EMPTY_HINT,
  NOTEBOOK_LOAD_ERROR,
  NOTEBOOK_LOAD_ERROR_HINT,
} from "@/lib/note-analysis";
import { notebookFeedView } from "@/lib/notes-list-state";
import { TAXONOMY_OPEN } from "@/lib/notebook-taxonomy";
import type { Category, Note, NoteStatus, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NotebookScreenProps {
  onOpenMobileNav: () => void;
}

export function NotebookScreen({ onOpenMobileNav }: NotebookScreenProps) {
  const {
    notes,
    total,
    hasMore,
    categories,
    tags,
    loading,
    loadError,
    loadingMore,
    filters,
    setFilter,
    loadMore,
    refresh,
    retryLoad,
    toggleFavorite,
    deleteNote,
  } = useNotes();

  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const openNote = useAppUi((s) => s.openNote);

  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);
  const [taxonomyOpen, setTaxonomyOpen] = useState(false);

  const isAll =
    filters.categoryId === null &&
    filters.favorite === false &&
    !filters.reminders &&
    filters.tagId === null;
  const isFavorite = filters.favorite;

  const confirmDelete = () => {
    if (deleteTarget) void deleteNote(deleteTarget.id);
    setDeleteTarget(null);
  };

  const hasFilters = !isAll;
  const feedView = notebookFeedView(loading, loadError, notes.length);

  return (
    <section
      aria-label="Блокнот"
      className="flex min-w-0 flex-1 flex-col bg-background"
    >
      {/* ── Sticky header ── */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 md:hidden"
          onClick={onOpenMobileNav}
          aria-label="Открыть меню"
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
        <h1 className="truncate text-sm font-semibold sm:text-[15px]">
          📓 Блокнот
        </h1>
        {total > 0 && (
          <Badge
            variant="secondary"
            className="shrink-0 rounded-full text-[11px] font-normal"
          >
            {total}
          </Badge>
        )}
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl px-3"
          onClick={() => setCaptureOpen(true)}
          aria-label="Записать мысль"
        >
          <PenLine className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Записать мысль</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 rounded-xl px-3"
          onClick={() => setTaxonomyOpen(true)}
          aria-label={TAXONOMY_OPEN}
        >
          <FolderKanban className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{TAXONOMY_OPEN}</span>
        </Button>
      </header>

      <NotebookStats
        onDueClick={() =>
          setFilter({
            categoryId: null,
            favorite: false,
            reminders: true,
            tagId: null,
          })
        }
      />

      {/* ── Filter chips ── */}
      <div className="shrink-0 border-b" role="group" aria-label="Фильтры заметок">
        <div className="vf-scroll-x flex items-center gap-2 overflow-x-auto px-3 py-2.5 sm:px-4">
          <FilterChip
            active={isAll}
            onClick={() =>
              setFilter({
                categoryId: null,
                favorite: false,
                reminders: false,
                tagId: null,
              })
            }
          >
            Все
          </FilterChip>
          <FilterChip
            active={isFavorite}
            onClick={() =>
              setFilter({
                categoryId: null,
                favorite: true,
                reminders: false,
                tagId: null,
              })
            }
          >
            <span aria-hidden="true">⭐</span> Избранные
          </FilterChip>
          <FilterChip
            active={filters.reminders}
            onClick={() =>
              setFilter({
                categoryId: null,
                favorite: false,
                reminders: true,
                tagId: null,
              })
            }
          >
            Напоминания
          </FilterChip>
          {categories.map((category) => (
            <CategoryFilterChip
              key={category.id}
              category={category}
              active={filters.categoryId === category.id}
              onClick={() =>
                setFilter({
                  categoryId: category.id,
                  favorite: false,
                  reminders: false,
                  tagId: null,
                })
              }
            />
          ))}
          {tags.map((tag) => (
            <TagFilterChip
              key={tag.id}
              tag={tag}
              active={filters.tagId === tag.id}
              onClick={() =>
                setFilter({
                  categoryId: null,
                  favorite: false,
                  reminders: false,
                  tagId: tag.id,
                })
              }
            />
          ))}
        </div>
      </div>

      {/* ── Feed ── */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        {feedView === "loading" ? (
          <div
            className="mx-auto w-full max-w-3xl space-y-4 p-4"
            aria-label="Загрузка заметок"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : feedView === "error" ? (
          <NotebookLoadError
            message={loadError ?? NOTEBOOK_LOAD_ERROR}
            onRetry={() => retryLoad()}
          />
        ) : feedView === "empty" ? (
          <EmptyState hasFilters={hasFilters} />
        ) : (
          <div className="mx-auto w-full max-w-3xl space-y-4 p-4 pb-8">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onOpen={() => openNote(note)}
                onToggleFavorite={() => void toggleFavorite(note)}
                onDelete={() => setDeleteTarget(note)}
              />
            ))}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-xl"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                >
                  {loadingMore && (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  {loadingMore ? "Загружаем…" : "Загрузить ещё"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заметку?</AlertDialogTitle>
            <AlertDialogDescription>
              Заметка «{deleteTarget?.rawText?.slice(0, 80)}
              {deleteTarget && (deleteTarget.rawText?.length ?? 0) > 80 ? "…" : ""}
              » будет удалена безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <NotebookTaxonomyDialog
        open={taxonomyOpen}
        onOpenChange={setTaxonomyOpen}
        onChanged={(kind, deletedId) => {
          if (kind === "category" && deletedId && filters.categoryId === deletedId) {
            setFilter({ categoryId: null });
          }
          if (kind === "tag" && deletedId && filters.tagId === deletedId) {
            setFilter({ tagId: null });
          }
          refresh();
        }}
      />
    </section>
  );
}

/* ── Filter chip ── */

function CategoryFilterChip({
  category,
  active,
  onClick,
}: {
  category: Category;
  active: boolean;
  onClick: () => void;
}) {
  const style = categoryColorStyle(category.color);
  return (
    <FilterChip
      active={active}
      onClick={onClick}
      aria-label={`Категория «${category.name}»`}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", style.dot)}
      />
      <CategoryGlyph icon={category.icon} className="size-3.5 shrink-0" />
      <span className="whitespace-nowrap">{category.name}</span>
      <span className="text-muted-foreground/70">{category.noteCount}</span>
    </FilterChip>
  );
}

function TagFilterChip({
  tag,
  active,
  onClick,
}: {
  tag: Tag;
  active: boolean;
  onClick: () => void;
}) {
  const style = categoryColorStyle(tag.color);
  return (
    <FilterChip
      active={active}
      onClick={onClick}
      aria-label={`Тег «${tag.name}»`}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", style.dot)}
      />
      <span className="whitespace-nowrap">#{tag.name}</span>
      <span className="text-muted-foreground/70">{tag.noteCount}</span>
    </FilterChip>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        active
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-card text-foreground/90 hover:bg-accent/60",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ── Note card ── */

/** Status chip swap animation (150ms fade/scale, popLayout keeps the row flow). */
const statusChipVariants: Variants = {
  initial: { opacity: 0, scale: 0.9 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.15, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.15, ease: "easeIn" },
  },
};

/** Analysis pipeline mini-chip: pending / processing / processed / error. */
function NoteStatusChip({ status }: { status: NoteStatus }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {status === "processed" ? (
        <motion.span
          key="processed"
          variants={statusChipVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 text-[11px] font-medium text-emerald-700/90 dark:border-emerald-400/20 dark:bg-emerald-400/5 dark:text-emerald-300/90"
        >
          <Sparkles className="size-3" aria-hidden="true" />
          Проанализирована
        </motion.span>
      ) : status === "error" ? (
        <motion.span
          key="error"
          variants={statusChipVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300"
        >
          <AlertTriangle className="size-3" aria-hidden="true" />
          Ошибка анализа
        </motion.span>
      ) : (
        <motion.span
          key={status}
          variants={statusChipVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
        >
          {status === "processing" ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <span
              aria-hidden="true"
              className="vf-status-pulse size-1.5 rounded-full bg-amber-500"
            />
          )}
          {status === "processing" ? "Анализируем…" : "Анализ в очереди"}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function NoteCard({
  note,
  onOpen,
  onToggleFavorite,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const style = note.category
    ? categoryColorStyle(note.category.color)
    : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="group rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary/30 hover:bg-accent/10"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {note.category && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                style?.chip,
              )}
            >
              <CategoryGlyph icon={note.category.icon} className="size-3" />
              <span className="max-w-40 truncate">{note.category.name}</span>
            </span>
          )}
          <NoteStatusChip status={note.status} />
          {(note.tags ?? []).slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                categoryColorStyle(tag.color).chip,
              )}
            >
              #{tag.name}
            </span>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-muted-foreground hover:text-amber-500"
          onClick={onToggleFavorite}
          aria-label={
            note.favorite
              ? "Убрать заметку из избранного"
              : "Добавить заметку в избранное"
          }
          aria-pressed={note.favorite}
        >
          <Star
            className={cn(
              "size-4 transition-colors duration-150",
              note.favorite && "fill-amber-400 text-amber-500",
            )}
            aria-hidden="true"
          />
        </Button>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-2 w-full rounded-lg text-left text-sm leading-relaxed whitespace-pre-wrap line-clamp-3 outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {note.rawText || ""}
      </button>

      {note.status === "processed" && note.recommendations?.[0] && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
          className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground"
        >
          <ListChecks
            className="mt-0.5 size-3.5 shrink-0 text-emerald-600/70 dark:text-emerald-400/70"
            aria-hidden="true"
          />
          <span className="line-clamp-1">{note.recommendations[0]}</span>
        </motion.p>
      )}

      <footer className="mt-3 flex items-center justify-between gap-2">
        <time
          dateTime={note.createdAt}
          className="text-[11px] text-muted-foreground"
        >
          {formatNoteDate(note.createdAt)}
        </time>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground opacity-100 transition-colors duration-150 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          onClick={onDelete}
          aria-label="Удалить заметку"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </Button>
      </footer>
    </motion.article>
  );
}

/* ── Empty / error states ── */

function NotebookLoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
      >
        <AlertTriangle className="size-7" />
      </span>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{message}</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {NOTEBOOK_LOAD_ERROR_HINT}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-xl"
        onClick={onRetry}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Попробовать снова
      </Button>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <NotebookPen className="size-7" />
      </span>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">
          {hasFilters ? NOTEBOOK_FILTER_EMPTY : NOTEBOOK_EMPTY}
        </p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {hasFilters ? NOTEBOOK_FILTER_EMPTY_HINT : NOTEBOOK_EMPTY_HINT}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-xl border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
        onClick={() => setCaptureOpen(true)}
      >
        <PenLine className="size-4" aria-hidden="true" />
        Записать мысль
      </Button>
    </div>
  );
}
