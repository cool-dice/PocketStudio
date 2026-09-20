"use client";

/**
 * Вкладка «Код» воркспейса: редактор файлов **этого** Project.id.
 * Воркспейс типа «Приложение» при создании получает шаблон на диске;
 * если файлов ещё нет, дерево API само создаст шаблон.
 */

import { FileCode2 } from "lucide-react";

import { ProjectScreen } from "@/components/app/project-screen";
import { WorkspaceModuleFrame } from "@/components/workspaces/workspace-tabs-ui";
import type { WorkspaceSummary } from "@/lib/workspace-data";

export function WorkspaceCodeTab({
  workspace,
  onOpenMobileNav,
}: {
  workspace: WorkspaceSummary;
  onOpenMobileNav: () => void;
}) {
  if (!workspace.id) {
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
            <p className="text-sm font-medium">Нет воркспейса</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Откройте воркспейс типа «Приложение», чтобы править его файлы.
            </p>
          </div>
        </div>
      </WorkspaceModuleFrame>
    );
  }

  return (
    <WorkspaceModuleFrame>
      <ProjectScreen
        key={workspace.id}
        projectId={workspace.id}
        onOpenMobileNav={onOpenMobileNav}
      />
    </WorkspaceModuleFrame>
  );
}
