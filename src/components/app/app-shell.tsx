"use client";

/**
 * AppShell — chat-first 3-zone layout:
 * left sidebar (threads, collections, profile) · center chat or notebook ·
 * right context (note detail / placeholder).
 * Below md the sidebar lives in a Sheet opened from the header hamburger;
 * the context panel is an xl+ zone, below xl note details open in a Dialog.
 * Also owns the global ⌘K / Ctrl+K quick-capture shortcut.
 */

import { useEffect, useState } from "react";

import { CaptureDialog } from "@/components/app/capture-dialog";
import { AdminScreen } from "@/components/app/admin-screen";
import { AiSettingsScreen } from "@/components/app/ai-settings-screen";
import { ChatArea } from "@/components/app/chat-area";
import { ContextPanel } from "@/components/app/context-panel";
import { CreateProjectDialog } from "@/components/app/create-project-dialog";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { GlobalSearch } from "@/components/app/global-search";
import { MobileNoteDialog } from "@/components/app/mobile-note-dialog";
import { NotebookScreen } from "@/components/app/notebook-screen";
import { ProjectScreen } from "@/components/app/project-screen";
import { ProjectsScreen } from "@/components/app/projects-screen";
import { SidebarContent } from "@/components/app/sidebar";
import {
  HomeScreen,
  LibraryScreen,
  ToolsScreen,
  WorkspacesScreen,
  WorkspaceShell,
} from "@/components/workspaces";
import { DocumentsScreen } from "@/components/studio/documents/documents-screen";
import { ImagesScreen } from "@/components/studio/images/images-screen";
import { DesignScreen } from "@/components/studio/design/design-screen";
import { AudioScreen } from "@/components/studio/audio/audio-screen";
import { VideoScreen } from "@/components/studio/video/video-screen";
import { DeployScreen } from "@/components/studio/deploy/deploy-screen";
import { McpScreen } from "@/components/studio/mcp/mcp-screen";
import { SkillsScreen } from "@/components/studio/skills/skills-screen";
import { MonetizeScreen } from "@/components/studio/monetize/monetize-screen";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAppUi } from "@/lib/store";

export function AppShell() {
  const mainArea = useAppUi((s) => s.mainArea);
  const activeProjectId = useAppUi((s) => s.activeProjectId);
  const contextOpen = useAppUi((s) => s.contextOpen);
  const setContextOpen = useAppUi((s) => s.setContextOpen);
  const setCaptureOpen = useAppUi((s) => s.setCaptureOpen);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Global ⌘K / Ctrl+K → quick capture (works in inputs; dialogs allowed).
  // Global ⌘P / Ctrl+P → global search across threads, notes, workspaces,
  // documents, entities, and artifacts.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useAppUi.getState().setCaptureOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        useAppUi.getState().setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* ── Left: sidebar (desktop ≥ md) ── */}
      <aside
        aria-label="Боковая панель"
        className="hidden w-72 shrink-0 flex-col border-r bg-sidebar md:flex"
      >
        <SidebarContent />
      </aside>

      {/* ── Left: sidebar (mobile < md, Sheet) ── */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-80 gap-0 border-r p-0 sm:max-w-sm"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Навигация</SheetTitle>
          <SidebarContent
            sheetMode
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Center: chat / notebook / projects / project detail / admin / studio ── */}
      {mainArea === "chat" ? (
        <ChatArea
          contextOpen={contextOpen}
          onToggleContext={() => setContextOpen(!contextOpen)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
      ) : mainArea === "notebook" ? (
        <NotebookScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "project" && activeProjectId ? (
        <ProjectScreen
          key={activeProjectId}
          projectId={activeProjectId}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
      ) : mainArea === "admin" ? (
        <AdminScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "settings" ? (
        <AiSettingsScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "documents" ? (
        <DocumentsScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "images" ? (
        <ImagesScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "design" ? (
        <DesignScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "audio" ? (
        <AudioScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "video" ? (
        <VideoScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "deploy" ? (
        <DeployScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "mcp" ? (
        <McpScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "skills" ? (
        <SkillsScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "monetize" ? (
        <MonetizeScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "home" ? (
        <HomeScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "workspaces" || mainArea === "workspace" ? (
        mainArea === "workspace" ? (
          <WorkspaceShell onOpenMobileNav={() => setMobileNavOpen(true)} />
        ) : (
          <WorkspacesScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
        )
      ) : mainArea === "library" ? (
        <LibraryScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : mainArea === "tools" ? (
        <ToolsScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      ) : (
        <ProjectsScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      )}

      {/* ── Right: context (xl+, только в полном чате) ── */}
      {(mainArea === "chat" || mainArea === "notebook") && contextOpen && (
        <ContextPanel onClose={() => setContextOpen(false)} />
      )}

      {/* ── Overlays ── */}
      <CaptureDialog />
      <CreateProjectDialog />
      <CreateWorkspaceDialog />
      <MobileNoteDialog />
      <GlobalSearch />
    </div>
  );
}
