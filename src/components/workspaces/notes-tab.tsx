"use client";

/**
 * NotesTab — заметки воркспейса через Note + NoteLink (не мок).
 * Typed create here (and agent create_note) never POSTs transcription.
 */

import { useEffect, useState } from "react";
import { ArrowUpRight, NotebookPen, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { invalidateWorkspaces } from "@/hooks/use-workspaces";
import { api, ApiError } from "@/lib/api";
import { notesListViewState } from "@/lib/notes-list-state";
import { NOTEBOOK_LOAD_ERROR } from "@/lib/note-analysis";
import { useAppUi } from "@/lib/store";
import type { Note } from "@/lib/types";
import { shouldShowTranscription } from "@/lib/voice-copy";
import { WORKSPACE_STAGES, type WorkspaceSummary } from "@/lib/workspace-data";
import { currentStageIndex, pluralNotes } from "@/components/workspaces/overview-data";
import { timeAgo } from "@/components/workspaces/home-data";

export function NotesTab({ workspace }: { workspace: WorkspaceSummary }) {
  const setMainArea = useAppUi((s) => s.setMainArea);
  const bumpNotes = useAppUi((s) => s.bumpNotes);
  const openNote = useAppUi((s) => s.openNote);
  const notesVersion = useAppUi((s) => s.notesVersion);

  const [notes, setNotes] = useState<Note[]>([]);
  const [notesWorkspaceId, setNotesWorkspaceId] = useState<string | null>(null);
  const [errorWorkspaceId, setErrorWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const currentStage =
    WORKSPACE_STAGES[workspace.type][currentStageIndex(workspace)] ??
    WORKSPACE_STAGES[workspace.type][0];

  const view = notesListViewState(
    workspace.id,
    notesWorkspaceId,
    errorWorkspaceId,
  );
  const visibleNotes = view === "ready" ? notes : [];

  useEffect(() => {
    let cancelled = false;
    const id = workspace.id;
    void (async () => {
      try {
        const res = await api.listNotes({ projectId: id, limit: 50 });
        if (cancelled) return;
        setNotes(res.notes);
        setNotesWorkspaceId(id);
        setErrorWorkspaceId(null);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setNotes([]);
        setNotesWorkspaceId(id);
        setErrorWorkspaceId(id);
        setError(
          err instanceof ApiError ? err.message : NOTEBOOK_LOAD_ERROR,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspace.id, notesVersion, reloadTick]);

  async function addNote() {
    const text = draft.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const note = await api.createNote({ text, projectId: workspace.id });
      setNotes((prev) => [note, ...prev]);
      setNotesWorkspaceId(workspace.id);
      setErrorWorkspaceId(null);
      setError(null);
      setDraft("");
      bumpNotes();
      invalidateWorkspaces();
      toast.success("Мысль записана", {
        description: `Привязана к воркспейсу · стадия «${currentStage}»`,
      });
      openNote(note);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Не удалось записать заметку",
      );
    } finally {
      setSaving(false);
    }
  }

  const subtitle =
    view === "loading"
      ? "Загрузка…"
      : view === "error"
        ? "Не удалось загрузить"
        : `${pluralNotes(visibleNotes.length)} · те же записи, что в Блокноте`;

  return (
    <div className="vf-scroll h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Заметки воркспейса</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setMainArea("notebook")}
            title="Открыть Блокнот"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <NotebookPen className="size-3.5" aria-hidden="true" />
            Все личные заметки — в Блокноте
            <ArrowUpRight className="size-3.5 text-primary" aria-hidden="true" />
          </button>
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void addNote();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Записать мысль в воркспейс…"
            aria-label="Новая заметка воркспейса"
            maxLength={5000}
            className="h-10 bg-card"
          />
          <Button
            type="submit"
            disabled={!draft.trim() || saving}
            className="h-10 shrink-0 gap-1.5"
          >
            <Plus className="size-4" aria-hidden="true" />
            {saving ? "Пишем…" : "Записать"}
          </Button>
        </form>

        <div className="mt-4 space-y-2">
          {view === "loading" ? (
            <div className="space-y-2" role="status" aria-label="Загрузка заметок">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : view === "error" ? (
            <div
              role="alert"
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center"
            >
              <p className="text-sm text-muted-foreground">
                {error ?? NOTEBOOK_LOAD_ERROR}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  setErrorWorkspaceId(null);
                  setNotesWorkspaceId(null);
                  setReloadTick((t) => t + 1);
                }}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Повторить
              </Button>
            </div>
          ) : visibleNotes.length > 0 ? (
            visibleNotes.map((note) => {
              const preview = (note.rawText ?? "").replace(/\s+/g, " ").trim();
              const hasTranscript = shouldShowTranscription(
                note.rawText,
                note.transcription,
              );
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => openNote(note)}
                  className="flex w-full flex-col rounded-xl border bg-card p-3 text-left outline-none transition-colors hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <span className="line-clamp-2 text-sm font-medium">
                    {preview || "Пустая заметка"}
                  </span>
                  <span className="mt-1 text-[11px] text-muted-foreground">
                    {timeAgo(note.createdAt)}
                    {note.category ? ` · ${note.category.name}` : ""}
                    {hasTranscript ? " · есть расшифровка" : ""}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
              <span
                className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <NotebookPen className="size-5" />
              </span>
              <p className="text-sm font-medium">Ни одной мысли пока нет</p>
              <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                Запишите первую мысль — она сохранится в Блокноте и останется
                привязанной к этому воркспейсу после перезагрузки.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
