"use client";

/**
 * NoteDetail — full note view for the context panel (xl+) and the mobile
 * note dialog: full text, category chip, meta, favorite / «Обсудить в чате» /
 * delete actions — plus the Stage 2 analysis pipeline UI:
 *
 * - status chip in the header (pending → processing → processed | error),
 *   patched live via WS events through the store (no refetches);
 * - «Анализ ИИ» section with the 4 LLM blocks: «Сильные стороны» (emerald),
 *   «Риски и слабые стороны» (amber), «Главный вывод» (neutral) and
 *   «Рекомендации» (numbered, emerald badges) — staggered reveal;
 * - error state with the excerpt + «Переанализировать», and a subtle
 *   re-run action next to the section title for processed notes.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
  AlertTriangle,
  Compass,
  FolderGit2,
  ListChecks,
  Loader2,
  MessageCircle,
  RotateCcw,
  Rocket,
  Sparkles,
  Star,
  ThumbsUp,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useThreads } from "@/hooks/use-threads";
import { formatNoteDate, textPreview } from "@/lib/format";
import { useAppUi } from "@/lib/store";
import {
  CategoryGlyph,
  categoryColorStyle,
} from "@/lib/category-style";
import { api } from "@/lib/api";
import type { Note, NoteProjectLink, NoteStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NoteDetailProps {
  note: Note;
  /** Dismiss the wrapper (mobile dialog) after discuss/delete. */
  onDismiss?: () => void;
}

/* ── Motion presets ── */

/** Status chip swap: quick fade/slide, works inside the flex-wrap chip row. */
const chipVariants: Variants = {
  initial: { opacity: 0, y: -2 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 2 },
};

/** Body state swap (waiting → analysis / error): 180ms, 4px slide. */
const stateVariants: Variants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

/** Analysis blocks: staggered reveal (~60ms apart). */
const blocksVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const blockVariants: Variants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: "easeOut" },
  },
};

const stateTransition = { duration: 0.18, ease: "easeOut" } as const;
const chipTransition = { duration: 0.15, ease: "easeOut" } as const;

/* ── Helpers ── */

/** Russian plural forms: 1 минута / 2 минуты / 5 минут. */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Relative ru date for analyzedAt: «только что», «5 минут назад», «вчера»… */
function formatRelativeDate(iso: string | null): string {
  if (!iso) return "";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const minutes = Math.floor((Date.now() - ts) / 60_000);
  if (minutes < 1) return "только что";
  if (minutes < 60) {
    return `${minutes} ${pluralRu(minutes, "минуту", "минуты", "минут")} назад`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ${pluralRu(hours, "час", "часа", "часов")} назад`;
  }
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) {
    return `${days} ${pluralRu(days, "день", "дня", "дней")} назад`;
  }
  return formatNoteDate(iso);
}

/* ── Status chip (header) ── */

function StatusChip({ status }: { status: NoteStatus }) {
  // processed → no chip: the «Анализ ИИ» section carries the state instead.
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {(status === "pending" || status === "processing") && (
        <motion.span
          key="waiting"
          variants={chipVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={chipTransition}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
        >
          {status === "processing" ? (
            <Loader2
              className="size-3 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <span
              aria-hidden="true"
              className="vf-status-pulse size-1.5 rounded-full bg-amber-500"
            />
          )}
          {status === "processing" ? "Анализируем…" : "Анализ в очереди"}
        </motion.span>
      )}
      {status === "error" && (
        <motion.span
          key="error"
          variants={chipVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={chipTransition}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300"
        >
          <AlertTriangle className="size-3" aria-hidden="true" />
          Ошибка анализа
        </motion.span>
      )}
    </AnimatePresence>
  );
}

/* ── Analysis block ── */

const BLOCK_TONES = {
  emerald: {
    panel: "border-emerald-500/25 bg-emerald-500/10 dark:border-emerald-400/20 dark:bg-emerald-400/5",
    icon: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-400",
  },
  amber: {
    panel: "border-amber-500/30 bg-amber-500/10 dark:border-amber-400/25 dark:bg-amber-400/5",
    icon: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400",
  },
  neutral: {
    panel: "border-border bg-muted/50",
    icon: "bg-muted-foreground/10 text-muted-foreground",
  },
} as const;

function AnalysisBlock({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: LucideIcon;
  title: string;
  tone: keyof typeof BLOCK_TONES;
  children: ReactNode;
}) {
  const t = BLOCK_TONES[tone];
  return (
    <motion.section
      variants={blockVariants}
      aria-label={title}
      className={cn("rounded-xl border p-4", t.panel)}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-lg",
            t.icon,
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
      </div>
      <div className="mt-3 text-sm leading-relaxed text-foreground">
        {children}
      </div>
    </motion.section>
  );
}

/* ── Linked projects (note ↔ project links) ── */

function LinkedProjects({ noteId }: { noteId: string }) {
  const openProject = useAppUi((s) => s.openProject);
  // Any project creation/import (incl. «Создать проект из заметки») bumps
  // projectsVersion → refetch so a fresh link shows up without reopening.
  const projectsVersion = useAppUi((s) => s.projectsVersion);
  const [links, setLinks] = useState<NoteProjectLink[] | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    try {
      const list = await api.listNoteLinks(noteId);
      setLinks(list);
    } catch {
      setLinks([]);
    }
  }, [noteId]);

  useEffect(() => {
    setLinks(null);
    void loadLinks();
  }, [loadLinks, projectsVersion]);

  const unlink = async (projectId: string) => {
    if (removingId) return;
    setRemovingId(projectId);
    try {
      await api.unlinkNoteFromProject(noteId, projectId);
      setLinks((prev) =>
        (prev ?? []).filter((l) => l.project.id !== projectId),
      );
    } catch {
      toast.error("Не удалось отвязать проект");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="mt-3 border-t pt-3">
      <h4 className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Связанные проекты
      </h4>
      {links === null ? (
        <div className="mt-2 px-1">
          <Skeleton className="h-6 w-40 rounded-full" />
        </div>
      ) : links.length === 0 ? (
        <p className="mt-1.5 px-1 text-xs leading-relaxed text-muted-foreground">
          Пока нет связанных проектов.
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {links.map((link) => (
            <li key={link.id} className="group/link">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/5 pl-2.5 pr-1.5 py-1 text-[11px] font-medium text-foreground/90">
                <button
                  type="button"
                  onClick={() => openProject(link.project.id)}
                  aria-label={`Открыть проект «${link.project.name}»`}
                  className="flex min-w-0 items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-full"
                >
                  <FolderGit2
                    className="size-3 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="max-w-36 truncate">{link.project.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void unlink(link.project.id)}
                  disabled={removingId === link.project.id}
                  aria-label={`Отвязать проект «${link.project.name}»`}
                  className="flex shrink-0 items-center rounded-full p-0.5 text-muted-foreground/60 opacity-0 transition-opacity duration-150 hover:text-destructive focus-visible:opacity-100 group-hover/link:opacity-100"
                >
                  {removingId === link.project.id ? (
                    <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <X className="size-3" aria-hidden="true" />
                  )}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── NoteDetail ── */

export function NoteDetail({ note, onDismiss }: NoteDetailProps) {
  const { sendMessage, busy } = useThreads();
  const setMainArea = useAppUi((s) => s.setMainArea);
  const closeNote = useAppUi((s) => s.closeNote);
  const updateContextNote = useAppUi((s) => s.updateContextNote);
  const bumpNotes = useAppUi((s) => s.bumpNotes);

  const [favBusy, setFavBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reanalyzeBusy, setReanalyzeBusy] = useState(false);
  const openCreateProject = useAppUi((s) => s.openCreateProject);

  const chipStyle = note.category
    ? categoryColorStyle(note.category.color)
    : null;

  const toggleFavorite = async () => {
    if (favBusy) return;
    setFavBusy(true);
    updateContextNote({ ...note, favorite: !note.favorite });
    try {
      const updated = await api.updateNote(note.id, {
        favorite: !note.favorite,
      });
      updateContextNote(updated);
      bumpNotes();
    } catch {
      updateContextNote(note);
      toast.error("Не удалось обновить заметку");
    } finally {
      setFavBusy(false);
    }
  };

  const discuss = async () => {
    const quote = textPreview(note.rawText ?? "", 120);
    onDismiss?.();
    setMainArea("chat");
    await sendMessage(`Помоги мне разобраться с этой заметкой: «${quote}»`);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteNote(note.id);
      bumpNotes();
      closeNote();
      onDismiss?.();
      toast.success("Заметка удалена");
    } catch {
      toast.error("Не удалось удалить заметку");
      setDeleting(false);
    }
  };

  /**
   * Re-queue LLM analysis: optimistic flip back to pending (analysis
   * cleared), then the analyzer worker re-runs it and the WS events patch
   * the note live again.
   */
  const reanalyze = async () => {
    if (reanalyzeBusy) return;
    setReanalyzeBusy(true);
    updateContextNote({
      ...note,
      status: "pending",
      positive: null,
      negative: null,
      final: null,
      recommendations: null,
      analyzedAt: null,
      errorMessage: null,
    });
    try {
      const updated = await api.reanalyzeNote(note.id);
      updateContextNote(updated);
      bumpNotes(); // notebook feed: status chip → «Анализ в очереди»
    } catch {
      updateContextNote(note);
      toast.error("Не удалось перезапустить анализ");
    } finally {
      setReanalyzeBusy(false);
    }
  };

  const hasBlocks =
    !!note.positive ||
    !!note.negative ||
    !!note.final ||
    (note.recommendations?.length ?? 0) > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Body ── */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {note.category && chipStyle && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                chipStyle.chip,
              )}
            >
              <CategoryGlyph icon={note.category.icon} className="size-3" />
              {note.category.name}
            </span>
          )}
          <StatusChip status={note.status} />
        </div>

        <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
          {note.rawText || ""}
        </p>

        {/* ── Analysis pipeline states (live via WS) ── */}
        <AnimatePresence initial={false} mode="wait">
          {note.status === "error" ? (
            <motion.section
              key="error"
              variants={stateVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stateTransition}
              aria-label="Ошибка анализа"
              className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-4"
            >
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                </span>
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Не удалось проанализировать
                </h4>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-foreground/80">
                {note.errorMessage
                  ? textPreview(note.errorMessage, 220)
                  : "Анализ завершился с ошибкой. Попробуйте запустить его ещё раз."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-9 gap-1.5 rounded-xl"
                onClick={() => void reanalyze()}
                disabled={reanalyzeBusy}
              >
                <RotateCcw
                  className={cn(
                    "size-3.5",
                    reanalyzeBusy && "animate-spin",
                  )}
                  aria-hidden="true"
                />
                Переанализировать
              </Button>
            </motion.section>
          ) : note.status === "pending" || note.status === "processing" ? (
            <motion.div
              key="waiting"
              variants={stateVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stateTransition}
              role="status"
              className="mt-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4"
            >
              <p className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                {note.status === "processing" ? (
                  <Loader2
                    className="size-3.5 shrink-0 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="vf-status-pulse size-2 shrink-0 rounded-full bg-amber-500"
                  />
                )}
                {note.status === "processing"
                  ? "Анализируем заметку…"
                  : "Анализ в очереди"}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                ИИ выделит сильные стороны, риски и главный вывод и даст
                рекомендации — результат появится здесь автоматически.
              </p>
            </motion.div>
          ) : note.status === "processed" ? (
            <motion.section
              key="analysis"
              variants={stateVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={stateTransition}
              aria-label="Анализ ИИ"
              className="mt-5"
            >
              <header className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Анализ ИИ
                </h3>
                <div className="flex min-w-0 items-center gap-1">
                  {note.analyzedAt && (
                    <time
                      dateTime={note.analyzedAt}
                      className="truncate text-[11px] text-muted-foreground"
                      title={formatNoteDate(note.analyzedAt)}
                    >
                      {formatRelativeDate(note.analyzedAt)}
                    </time>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-primary"
                    onClick={() => void reanalyze()}
                    disabled={reanalyzeBusy}
                    aria-label="Переанализировать заметку"
                    title="Переанализировать"
                  >
                    <RotateCcw
                      className={cn(
                        "size-3.5",
                        reanalyzeBusy && "animate-spin",
                      )}
                      aria-hidden="true"
                    />
                  </Button>
                </div>
              </header>

              <motion.div
                variants={blocksVariants}
                initial="hidden"
                animate="show"
                className="mt-3 space-y-4"
              >
                {note.positive && (
                  <AnalysisBlock
                    icon={ThumbsUp}
                    title="Сильные стороны"
                    tone="emerald"
                  >
                    <p className="whitespace-pre-wrap">{note.positive}</p>
                  </AnalysisBlock>
                )}
                {note.negative && (
                  <AnalysisBlock
                    icon={AlertTriangle}
                    title="Риски и слабые стороны"
                    tone="amber"
                  >
                    <p className="whitespace-pre-wrap">{note.negative}</p>
                  </AnalysisBlock>
                )}
                {note.final && (
                  <AnalysisBlock
                    icon={Compass}
                    title="Главный вывод"
                    tone="neutral"
                  >
                    <p className="whitespace-pre-wrap text-foreground">
                      {note.final}
                    </p>
                  </AnalysisBlock>
                )}
                {(note.recommendations?.length ?? 0) > 0 && (
                  <AnalysisBlock
                    icon={ListChecks}
                    title="Рекомендации"
                    tone="neutral"
                  >
                    <ol className="space-y-2">
                      {note.recommendations?.map((rec, i) => (
                        <li key={i} className="flex gap-2.5">
                          <span
                            aria-hidden="true"
                            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 whitespace-pre-wrap">
                            {rec}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </AnalysisBlock>
                )}
                {!hasBlocks && (
                  <motion.p
                    variants={blockVariants}
                    className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground"
                  >
                    Анализ завершился, но блоки пусты. Попробуйте
                    переанализировать заметку.
                  </motion.p>
                )}
              </motion.div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ── Meta + actions ── */}
      <div className="shrink-0 border-t p-3">
        <p className="px-1 pb-2 text-[11px] text-muted-foreground">
          Создана {formatNoteDate(note.createdAt)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-w-0 flex-1 gap-1.5 rounded-xl"
            onClick={() => void toggleFavorite()}
            disabled={favBusy}
            aria-pressed={note.favorite}
          >
            <Star
              className={cn(
                "size-3.5 transition-colors duration-150",
                note.favorite && "fill-amber-400 text-amber-500",
              )}
              aria-hidden="true"
            />
            <span className="truncate">
              {note.favorite ? "В избранном" : "В избранное"}
            </span>
          </Button>
          <Button
            size="sm"
            className="h-9 min-w-0 flex-1 gap-1.5 rounded-xl"
            onClick={() => void discuss()}
            disabled={busy}
            aria-label="Обсудить заметку в чате"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Обсудить
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-xl hover:border-primary/40 hover:text-primary"
            onClick={() => openCreateProject(note.id)}
            aria-label="Создать проект из заметки"
            title="В проект"
          >
            <Rocket className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 shrink-0 rounded-xl hover:border-destructive/40 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            aria-label="Удалить заметку"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        {/* ── Linked projects ── */}
        <LinkedProjects noteId={note.id} />
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmDelete(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить заметку?</AlertDialogTitle>
            <AlertDialogDescription>
              Заметка будет удалена безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
