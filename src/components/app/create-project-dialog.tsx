"use client";

/**
 * CreateProjectDialog — global project creation dialog (mounted in AppShell
 * next to CaptureDialog). Three origins on shadcn Tabs:
 * - «Шаблон» — Next.js starter, describe the goal (agent builds in chat);
 * - «GitHub» — public repo URL (https://github.com/owner/repo, depth-1 clone);
 * - «Архив ZIP» — drag-and-drop / pick a .zip ≤20MB.
 *
 * When opened from a note (openCreateProject(noteId)) the request carries
 * noteId → the backend links the note with kind 'context'. On success:
 * toast + navigate straight into the project screen. The form lives in an
 * inner component so closing resets all fields (same trick as CaptureDialog).
 */

import { useRef, useState, type DragEvent } from "react";
import {
  FileArchive,
  Github,
  LayoutTemplate,
  Loader2,
  Rocket,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useAppUi } from "@/lib/store";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";

const GITHUB_URL_RE = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
const MAX_ZIP_BYTES = 20 * 1024 * 1024;

type TabValue = "template" | "github" | "zip";

export function CreateProjectDialog() {
  const open = useAppUi((s) => s.createProjectOpen);
  const setCreateProjectOpen = useAppUi((s) => s.setCreateProjectOpen);

  return (
    <Dialog open={open} onOpenChange={setCreateProjectOpen}>
      <DialogContent
        className="top-[50%] max-h-[85vh] translate-y-[-50%] overflow-y-auto gap-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Rocket className="size-4 text-primary" aria-hidden="true" />
            Новый проект
          </DialogTitle>
          <DialogDescription className="sr-only">
            Создание проекта из шаблона, GitHub или zip-архива
          </DialogDescription>
        </DialogHeader>
        {open && <CreateProjectForm />}
      </DialogContent>
    </Dialog>
  );
}

function CreateProjectForm() {
  const noteId = useAppUi((s) => s.createProjectNoteId);
  const setCreateProjectOpen = useAppUi((s) => s.setCreateProjectOpen);
  const openProject = useAppUi((s) => s.openProject);
  const bumpProjects = useAppUi((s) => s.bumpProjects);

  const [tab, setTab] = useState<TabValue>("template");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [remoteUrl, setRemoteUrl] = useState("");
  const [remoteTouched, setRemoteTouched] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length === 0
      ? "Название обязательно"
      : trimmedName.length > 80
        ? "Не больше 80 символов"
        : null;
  const remoteError =
    tab === "github" && remoteTouched && !GITHUB_URL_RE.test(remoteUrl.trim())
      ? "Введите адрес вида https://github.com/владелец/репозиторий"
      : null;
  const fileError =
    tab === "zip" && file
      ? file.size > MAX_ZIP_BYTES
        ? "Архив больше 20 МБ"
        : null
      : null;

  const canSubmit =
    !submitting &&
    !nameError &&
    !remoteError &&
    !fileError &&
    (tab === "zip" ? file !== null : true) &&
    (tab === "github" ? GITHUB_URL_RE.test(remoteUrl.trim()) : true);

  const pickFile = (picked: File | null | undefined) => {
    setError(null);
    if (!picked) {
      setFile(null);
      return;
    }
    if (!picked.name.toLowerCase().endsWith(".zip")) {
      setFile(null);
      setError("Нужен файл .zip");
      return;
    }
    if (picked.size > MAX_ZIP_BYTES) {
      setFile(picked); // keep it visible with the size error
      return;
    }
    setFile(picked);
  };

  const onDrop = (e: DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let project;
      if (tab === "zip" && file) {
        const fd = new FormData();
        fd.set("name", trimmedName);
        if (description.trim()) fd.set("description", description.trim());
        if (noteId) fd.set("noteId", noteId);
        fd.set("file", file);
        project = await api.createProjectFromZipRaw(fd);
      } else {
        project = await api.createProject({
          name: trimmedName,
          description: description.trim() || undefined,
          origin: tab === "github" ? "github" : "template",
          remoteUrl: tab === "github" ? remoteUrl.trim() : undefined,
          noteId: noteId ?? undefined,
        });
      }
      bumpProjects();
      setCreateProjectOpen(false);
      openProject(project.id);
      toast.success("Проект создан", { description: project.name });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Не удалось создать проект";
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {noteId && (
        <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
          <LayoutTemplate className="size-3" aria-hidden="true" />
          Из заметки — проект будет связан с ней
        </p>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="template" className="gap-1.5">
            <LayoutTemplate className="size-3.5" aria-hidden="true" />
            Шаблон
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-1.5">
            <Github className="size-3.5" aria-hidden="true" />
            GitHub
          </TabsTrigger>
          <TabsTrigger value="zip" className="gap-1.5">
            <FileArchive className="size-3.5" aria-hidden="true" />
            Архив ZIP
          </TabsTrigger>
        </TabsList>

        {/* ── Common fields (inside the active tab content visually) ── */}
        <div className="space-y-3 pt-3">
          <div className="space-y-1.5">
            <label htmlFor="project-name" className="text-xs font-medium text-muted-foreground">
              Название
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Трекер привычек"
              maxLength={80}
              autoFocus
              disabled={submitting}
              aria-invalid={trimmedName.length > 80}
            />
          </div>

          <TabsContent value="template" className="mt-0">
            <p className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              Стартовый Next.js проект — опишите агенту что построить: он
              создаст файлы прямо в чате в режиме «Действовать».
            </p>
          </TabsContent>

          <TabsContent value="github" className="mt-0">
            <div className="space-y-1.5">
              <label htmlFor="project-remote" className="text-xs font-medium text-muted-foreground">
                Репозиторий
              </label>
              <Input
                id="project-remote"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                onBlur={() => setRemoteTouched(true)}
                placeholder="https://github.com/owner/repo"
                inputMode="url"
                disabled={submitting}
                aria-invalid={remoteError !== null}
              />
              {remoteError && (
                <p className="text-xs text-destructive" role="alert">
                  {remoteError}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="zip" className="mt-0">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              aria-label="Выбрать zip-архив"
              className={cn(
                "flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-4 text-center outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring/60",
                dragOver
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-muted/30 hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              <UploadCloud className="size-5 text-muted-foreground" aria-hidden="true" />
              {file ? (
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {file.name}
                  </span>
                  <span
                    className={cn(
                      "block text-xs",
                      fileError ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {formatBytes(file.size)}
                  </span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Перетащите .zip сюда или нажмите для выбора
                  <span className="mt-0.5 block text-xs">
                    до 20 МБ, внутри может быть папка-корень
                  </span>
                </span>
              )}
            </button>
            {fileError && (
              <p className="mt-1.5 text-xs text-destructive" role="alert">
                {fileError}
              </p>
            )}
          </TabsContent>

          <div className="space-y-1.5">
            <label htmlFor="project-description" className="text-xs font-medium text-muted-foreground">
              Описание <span className="font-normal">(необязательно)</span>
            </label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Пара слов о проекте"
              rows={2}
              maxLength={500}
              disabled={submitting}
              className="resize-none"
            />
          </div>
        </div>
      </Tabs>

      {error && (
        <p
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <Button
        type="button"
        className="h-10 w-full gap-2 rounded-xl"
        onClick={() => void submit()}
        disabled={!canSubmit}
        aria-label="Создать проект"
      >
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {tab === "zip"
              ? "Распаковываем архив…"
              : tab === "github"
                ? "Клонируем репозиторий…"
                : "Создаём проект…"}
          </>
        ) : (
          <>
            <Rocket className="size-4" aria-hidden="true" />
            Создать проект
          </>
        )}
      </Button>
    </div>
  );
}
