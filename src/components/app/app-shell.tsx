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
import { ChatArea } from "@/components/app/chat-area";
import { ContextPanel } from "@/components/app/context-panel";
import { CreateProjectDialog } from "@/components/app/create-project-dialog";
import { GlobalSearch } from "@/components/app/global-search";
import { MobileNoteDialog } from "@/components/app/mobile-note-dialog";
import { NotebookScreen } from "@/components/app/notebook-screen";
import { ProjectScreen } from "@/components/app/project-screen";
import { ProjectsScreen } from "@/components/app/projects-screen";
import { SidebarContent } from "@/components/app/sidebar";
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
  // Global ⌘P / Ctrl+P → global search across threads / notes / projects.
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

      {/* ── Center: chat / notebook / projects / project detail ── */}
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
      ) : (
        <ProjectsScreen onOpenMobileNav={() => setMobileNavOpen(true)} />
      )}

      {/* ── Right: context (xl+) ── */}
      {contextOpen && <ContextPanel onClose={() => setContextOpen(false)} />}

      {/* ── Overlays ── */}
      <CaptureDialog />
      <CreateProjectDialog />
      <MobileNoteDialog />
      <GlobalSearch />
    </div>
  );
}
