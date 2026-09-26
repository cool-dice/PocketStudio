"use client";

/**
 * ProjectsScreen — center-zone view: sticky header (title + count +
 * «Новый проект»), responsive card grid (1/2/3 cols). Cards show the origin
 * badge, description, stats (files / commits / relative date) and the last
 * commit message; hover lifts + emerald border (framer-motion). Per-card
 * dropdown: открыть / удалить (AlertDialog confirm). The feed itself scrolls
 * (vf-scroll) so long lists never push the layout.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  File,
  GitCommitHorizontal,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  Rocket,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import { pluralCommits, pluralFiles, relativeTime } from "@/lib/format";
import { OriginBadge } from "@/lib/project-style";
import { useAppUi } from "@/lib/store";
import type { ProjectListItem } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProjectsScreenProps {
  onOpenMobileNav: () => void;
}

export function ProjectsScreen({ onOpenMobileNav }: ProjectsScreenProps) {
  const { projects, loading, error, refresh, remove } = useProjects();
  const openProject = useAppUi((s) => s.openProject);
  const openCreateProject = useAppUi((s) => s.openCreateProject);

  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await remove(deleteTarget.id);
      toast.success("Проект удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить проект");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <section
      aria-label="Проекты"
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
          🚀 Проекты
        </h1>
        {projects.length > 0 && (
          <Badge
            variant="secondary"
            className="shrink-0 rounded-full text-[11px] font-normal"
          >
            {projects.length}
          </Badge>
        )}
        <div className="flex-1" />
        <Button
          size="sm"
          className="h-9 gap-2 rounded-xl px-3"
          onClick={() => openCreateProject()}
          aria-label="Новый проект"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Новый проект</span>
        </Button>
      </header>

      {/* ── Feed ── */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div
            className="mx-auto w-full max-w-5xl p-4"
            aria-label="Загрузка проектов"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Не удалось загрузить проекты
            </p>
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={refresh}>
              <Loader2 className="size-4" aria-hidden="true" />
              Повторить
            </Button>
          </div>
        ) : projects.length === 0 ? (
          <EmptyState onOpenCreate={() => openCreateProject()} />
        ) : (
          <div className="mx-auto w-full max-w-5xl p-4 pb-8">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={() => openProject(project.id)}
                  onDelete={() => setDeleteTarget(project)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Delete confirmation ── */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteTarget?.name}»: файлы и git-история будут удалены
              безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/* ── Project card ── */

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectListItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const stats = project.stats;
  const lastCommit = stats?.lastCommit;

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className="group relative flex flex-col rounded-xl border bg-card p-4 transition-colors duration-150 hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <OriginBadge origin={project.origin} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground opacity-100 transition-colors duration-150 hover:text-foreground md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              aria-label={`Действия с проектом «${project.name}»`}
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={onOpen}>
              <Rocket className="size-4" aria-hidden="true" />
              Открыть
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={onDelete}
            >
              Удалить проект
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-2.5 min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-lg"
        aria-label={`Открыть проект «${project.name}»`}
        title={project.name}
      >
        <h3 className="truncate text-sm font-semibold">
          {project.name}
        </h3>
        {project.description && (
          <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground">
            {project.description}
          </p>
        )}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1" title="Файлов в проекте">
          <File className="size-3" aria-hidden="true" />
          {stats?.filesCount ?? 0} {pluralFiles(stats?.filesCount ?? 0)}
        </span>
        <span
          className="inline-flex items-center gap-1"
          title="Коммитов (чекпоинтов)"
        >
          <GitCommitHorizontal className="size-3" aria-hidden="true" />
          {stats?.commitsCount ?? 0}
        </span>
        <span className="ml-auto inline-flex items-center" title="Обновлён">
          {relativeTime(project.updatedAt)}
        </span>
      </div>

      <p
        className={cn(
          "mt-2 truncate border-t pt-2 text-[11px] text-muted-foreground",
          "flex items-center gap-1.5",
        )}
        title={lastCommit?.message ?? ""}
      >
        <GitCommitHorizontal
          className="size-3 shrink-0 text-emerald-700 dark:text-emerald-400"
          aria-hidden="true"
        />
        {lastCommit ? lastCommit.message : "Изменений пока нет"}
      </p>
    </motion.article>
  );
}

/* ── Empty state ── */

function EmptyState({ onOpenCreate }: { onOpenCreate: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <span
        aria-hidden="true"
        className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"
      >
        <Rocket className="size-7" />
      </span>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Пока нет проектов</p>
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          Создайте первый из шаблона, GitHub или zip-архива — или попросите
          агента в чате: «создай проект трекер привычек».
        </p>
      </div>
      <Button
        size="sm"
        className="gap-2 rounded-xl"
        onClick={onOpenCreate}
      >
        <Plus className="size-4" aria-hidden="true" />
        Новый проект
      </Button>
    </div>
  );
}
