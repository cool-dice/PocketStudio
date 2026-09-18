"use client";

/**
 * WorkspaceTabContent — контент вкладки воркспейса (владение PS-3-d).
 *
 * ШОВ ФУНДАМЕНТА: WorkspaceShell рендерит эту компоненту для активной
 * вкладки (Обзор и Заметки обрабатываются самой оболочкой PS-3-b до
 * вызова шва). Реальные экраны модулей студии встраиваются сюда КАК
 * ВКЛАДКИ воркспейса — с их собственными заголовками и внутренними
 * скроллами (рамка WorkspaceModuleFrame даёт корректную высоту).
 *
 * Маршруты вкладок:
 *  documents / images / audio / video / design / deploy / monetize —
 *    прямое встраивание соответствующего экрана студии;
 *  code   — реальный проект студии (ProjectScreen) либо пустое
 *           состояние с созданием проекта;
 *  chat   — демо-кокпит оркестратора этого воркспейса (до Фазы A);
 *  прочее — мягкий плейсхолдер (безопасный фолбэк).
 */

import type { ComponentType } from "react";

import { AudioScreen } from "@/components/studio/audio/audio-screen";
import { DeployScreen } from "@/components/studio/deploy/deploy-screen";
import { DesignScreen } from "@/components/studio/design/design-screen";
import { DocumentsScreen } from "@/components/studio/documents/documents-screen";
import { ImagesScreen } from "@/components/studio/images/images-screen";
import { MonetizeScreen } from "@/components/studio/monetize/monetize-screen";
import { VideoScreen } from "@/components/studio/video/video-screen";
import { WorkspaceChatTab } from "@/components/workspaces/workspace-chat-tab";
import { WorkspaceCodeTab } from "@/components/workspaces/workspace-code-tab";
import {
  WorkspaceModuleFrame,
  WorkspaceTabMetaPlaceholder,
} from "@/components/workspaces/workspace-tabs-ui";
import type { WorkspaceSummary, WorkspaceTab } from "@/lib/workspace-data";

export interface WorkspaceTabContentProps {
  workspace: WorkspaceSummary;
  tab: WorkspaceTab;
  onOpenMobileNav: () => void;
}

/** Встраиваемые экраны студии: вкладка → компонент (пропы совпадают). */
const EMBEDDED_MODULE_SCREENS = {
  documents: DocumentsScreen,
  images: ImagesScreen,
  audio: AudioScreen,
  video: VideoScreen,
  design: DesignScreen,
  deploy: DeployScreen,
  monetize: MonetizeScreen,
} satisfies Record<
  string,
  ComponentType<{ onOpenMobileNav: () => void }>
>;

export function WorkspaceTabContent({
  workspace,
  tab,
  onOpenMobileNav,
}: WorkspaceTabContentProps) {
  const ModuleScreen = EMBEDDED_MODULE_SCREENS[tab];
  if (ModuleScreen) {
    return (
      <WorkspaceModuleFrame>
        <ModuleScreen onOpenMobileNav={onOpenMobileNav} />
      </WorkspaceModuleFrame>
    );
  }

  if (tab === "code") {
    return (
      <WorkspaceCodeTab
        workspace={workspace}
        onOpenMobileNav={onOpenMobileNav}
      />
    );
  }

  if (tab === "chat") {
    return <WorkspaceChatTab key={workspace.id} workspace={workspace} />;
  }

  /* Обзор/Заметки обрабатываются оболочкой; сюда попадаем только
     в защитных сценариях — мягкий плейсхолдер вместо пустоты. */
  return <WorkspaceTabMetaPlaceholder workspace={workspace} tab={tab} />;
}
