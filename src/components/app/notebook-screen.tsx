"use client";

/**
 * NotebookScreen — center-zone view (replaces ChatArea while active):
 * sticky header (title + count + quick-capture), horizontally scrollable
 * filter chips (Все / ⭐ Избранные / dynamic categories), NoteCard feed with
 * optimistic favorite/delete, «Загрузить ещё» pagination, skeletons and a
 * friendly empty state.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  Menu,
  NotebookPen,
  PenLine,
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
import { useNotes } from "@/hooks/use-notes";
import { formatNoteDate } from "@/lib/format";
import { useAppUi } from "@/lib/store";
import {
  CategoryGlyph,
  categoryColorStyle,
} from "@/lib/category-style";
import type { Category, Note } from "@/lib/types";
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
    loading,
    loadingMore,
    filters,
    setFilter,
    loadMore,
    toggleFavorite,
    deleteNote,
  } = useNotes();

  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);
  const openNote = useAppUi((s) => s.openNote);

  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null);

  const isAll =
    filters.categoryId === null && filters.favorite === false;
  const isFavorite = filters.favorite;

  const confirmDelete = () => {
    if (deleteTarget) void deleteNote(deleteTarget.id);
    setDeleteTarget(null);
  };

  const hasFilters = !isAll;

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
      </header>

      {/* ── Filter chips ── */}
      <div className="shrink-0 border-b" role="group" aria-label="Фильтры заметок">
        <div className="vf-scroll-x flex items-center gap-2 overflow-x-auto px-3 py-2.5 sm:px-4">
          <FilterChip
            active={isAll}
            onClick={() => setFilter({ categoryId: null, favorite: false })}
          >
            Все
          </FilterChip>
          <FilterChip
            active={isFavorite}
            onClick={() => setFilter({ categoryId: null, favorite: true })}
          >
            <span aria-hidden="true">⭐</span> Избранные
          </FilterChip>
          {categories.map((category) => (
            <CategoryFilterChip
              key={category.id}
              category={category}
              active={filters.categoryId === category.id}
              onClick={() =>
                setFilter({ categoryId: category.id, favorite: false })
              }
            />
          ))}
        </div>
      </div>

      {/* ── Feed ── */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div
            className="mx-auto w-full max-w-3xl space-y-4 p-4"
            aria-label="Загрузка заметок"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : notes.length === 0 ? (
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
          {note.status === "pending" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              <span
                aria-hidden="true"
                className="vf-status-pulse size-1.5 rounded-full bg-amber-500"
              />
              Анализ скоро
            </span>
          )}
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

/* ── Empty state ── */

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
          {hasFilters ? "Здесь пока пусто" : "Пока пусто"}
        </p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          {hasFilters
            ? "В этом фильтре нет заметок. Попробуйте другой фильтр или запишите новую мысль."
            : "Запишите первую мысль через ⌘K или попросите агента в чате — всё появится здесь."}
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
