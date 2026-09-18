"use client";

/**
 * NotesTab — «Заметки» воркспейса (PS-3-b).
 *
 * Заметки текущего воркспейса (карточки артефактов kind="note") +
 * композер быстрой мысли (мок: локальный state) + переход к глобальному
 * Блокноту + превью-диалог выбранной заметки.
 */

import { useMemo, useState } from "react";
import { ArrowUpRight, NotebookPen, Plus } from "lucide-react";
import { toast } from "sonner";

import { ArtifactCard } from "@/components/workspaces/shared/artifact-card";
import {
  artifactsOfWorkspace,
  type ArtifactItem,
} from "@/components/workspaces/shared/artifacts-data";
import { currentStageIndex, pluralNotes } from "@/components/workspaces/overview-data";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAppUi } from "@/lib/store";
import { WORKSPACE_STAGES, type WorkspaceSummary } from "@/lib/workspace-data";

export function NotesTab({ workspace }: { workspace: WorkspaceSummary }) {
  const setMainArea = useAppUi((s) => s.setMainArea);

  const [draft, setDraft] = useState("");
  const [localNotes, setLocalNotes] = useState<ArtifactItem[]>([]);
  const [openNote, setOpenNote] = useState<ArtifactItem | null>(null);

  const notes = useMemo(() => {
    const mockNotes = artifactsOfWorkspace(workspace.id).filter(
      (a) => a.kind === "note",
    );
    return [...localNotes, ...mockNotes];
  }, [localNotes, workspace.id]);

  const currentStage =
    WORKSPACE_STAGES[workspace.type][currentStageIndex(workspace)];

  function addNote() {
    const text = draft.trim();
    if (!text) return;
    const note: ArtifactItem = {
      id: `local-note-${Date.now()}`,
      workspaceId: workspace.id,
      kind: "note",
      title: text,
      meta: `записано сейчас · стадия «${currentStage}»`,
      stage: currentStage,
      createdAgo: "только что",
      gradient: "from-emerald-500/50 to-stone-400/30",
    };
    setLocalNotes((prev) => [note, ...prev]);
    setDraft("");
    toast.success("Мысль записана", {
      description: `Заметка прицеплена к стадии «${currentStage}». Пока хранится в этом сеансе.`,
    });
  }

  return (
    <div className="vf-scroll h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
        {/* ── Заголовок + переход в Блокнот ── */}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Заметки воркспейса</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pluralNotes(notes.length)} · привязаны к стадиям пайплайна
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMainArea("notebook")}
            title="Открыть Блокнот"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            <NotebookPen className="size-3.5" aria-hidden="true" />
            Глобальные заметки живут в Блокноте
            <ArrowUpRight className="size-3.5 text-primary" aria-hidden="true" />
          </button>
        </div>

        {/* ── Композер быстрой мысли ── */}
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addNote();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Записать мысль в воркспейс…"
            aria-label="Новая заметка воркспейса"
            maxLength={140}
            className="h-10 bg-card"
          />
          <Button
            type="submit"
            disabled={!draft.trim()}
            className="h-10 shrink-0 gap-1.5"
          >
            <Plus className="size-4" aria-hidden="true" />
            Записать
          </Button>
        </form>

        {/* ── Список заметок ── */}
        <div className="mt-4 space-y-2">
          {notes.length > 0 ? (
            notes.map((note) => (
              <ArtifactCard
                key={note.id}
                artifact={note}
                onOpen={(a) => setOpenNote(a)}
              />
            ))
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
                Запишите первую мысль в поле выше — она прицепится к текущей
                стадии «{currentStage}» и будет видна в Обзоре.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          Заметки воркспейса живут рядом с его артефактами; личные мысли вне
          контекста — в глобальном Блокноте.
        </p>
      </div>

      {/* ── Превью заметки (мок) ── */}
      <Dialog
        open={openNote !== null}
        onOpenChange={(open) => {
          if (!open) setOpenNote(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-8 leading-snug">
              {openNote?.title}
            </DialogTitle>
            <DialogDescription>
              Заметка · стадия «{openNote?.stage}» · {openNote?.createdAgo}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed text-muted-foreground">
            Полный текст заметки появится здесь вместе с редактором волны PS-3.
            Карточка уже привязана к стадии «{openNote?.stage}» и видна в
            Обзоре этого воркспейса.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNote(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
