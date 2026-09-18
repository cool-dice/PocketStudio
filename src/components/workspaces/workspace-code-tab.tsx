"use client";

/**
 * WorkspaceCodeTab — вкладка «Код» воркспейса (PS-3-d).
 *
 * Для воркспейсов типа «Приложение» (и любых, кому открыли вкладку):
 * находит реальный проект студии (мок-ассоциация волны PS-3 — первый
 * проект аккаунта ↔ «PocketLanding») и встраивает ProjectScreen.
 * Нет проектов → дружелюбное пустое состояние с кнопкой создания
 * (глобальный диалог CreateProjectDialog из AppShell).
 */

import { FileCode2, Plus, RefreshCw } from "lucide-react";

import { ProjectScreen } from "@/components/app/project-screen";
import { WorkspaceModuleFrame } from "@/components/workspaces/workspace-tabs-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjects } from "@/hooks/use-projects";
import { useAppUi } from "@/lib/store";
import type { WorkspaceSummary } from "@/lib/workspace-data";

function CodeLoadingSkeleton() {
  return (
    <WorkspaceModuleFrame>
      <div className="shrink-0 border-b px-4 py-3 sm:px-6">
        <Skeleton className="h-6 w-52" />
      </div>
      <div className="flex min-h-0 flex-1 gap-4 p-4 sm:p-6">
        <Skeleton className="hidden w-64 shrink-0 sm:block" />
        <Skeleton className="min-w-0 flex-1" />
      </div>
    </WorkspaceModuleFrame>
  );
}

export function WorkspaceCodeTab({
  workspace,
  onOpenMobileNav,
}: {
  workspace: WorkspaceSummary;
  onOpenMobileNav: () => void;
}) {
  const { projects, loading, error, refresh } = useProjects();
  const openCreateProject = useAppUi((s) => s.openCreateProject);

  /* Загрузка списка проектов — каркас вместо экрана. */
  if (loading && projects.length === 0) {
    return <CodeLoadingSkeleton />;
  }

  /* Ошибка загрузки — карточка с повтором. */
  if (error && projects.length === 0) {
    return (
      <WorkspaceModuleFrame>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"
            >
              <FileCode2 className="size-5" />
            </span>
            <p className="text-sm font-medium">Не удалось загрузить проекты</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Проверьте соединение и попробуйте ещё раз — вкладка «Код»
              воркспейса «{workspace.title}» зависит от списка проектов.
            </p>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Повторить
            </Button>
          </div>
        </div>
      </WorkspaceModuleFrame>
    );
  }

  /* Мок-ассоциация PS-3: первый проект аккаунта ↔ этот воркспейс. */
  const project = projects[0];
  if (project) {
    return (
      <WorkspaceModuleFrame>
        <ProjectScreen
          key={project.id}
          projectId={project.id}
          onOpenMobileNav={onOpenMobileNav}
        />
      </WorkspaceModuleFrame>
    );
  }

  /* Проектов нет — пустое состояние с созданием. */
  return (
    <WorkspaceModuleFrame>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm sm:p-8">
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-xl border bg-primary/10 text-primary"
          >
            <FileCode2 className="size-6" />
          </span>
          <p className="text-sm font-semibold">Нет проекта с кодом</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            В воркспейсе «{workspace.title}» пока нет ни одного проекта.
            Создайте первый — оркестратор поможет с hero-секцией, компонентами
            и адаптивом прямо в этом контексте.
          </p>
          <Button size="sm" onClick={() => openCreateProject()}>
            <Plus className="size-4" aria-hidden="true" />
            Создать проект
          </Button>
        </div>
      </div>
    </WorkspaceModuleFrame>
  );
}
