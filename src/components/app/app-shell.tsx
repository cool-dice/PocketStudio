"use client";

/**
 * AppShell — chat-first 3-zone layout:
 * left sidebar (threads, collections, profile) · center chat · right context.
 * Below md the sidebar lives in a Sheet opened from the chat header hamburger;
 * the context panel is a collapsible xl-only zone.
 */

import { useState } from "react";

import { ChatArea } from "@/components/app/chat-area";
import { ContextPanel } from "@/components/app/context-panel";
import { SidebarContent } from "@/components/app/sidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export function AppShell() {
  const [contextOpen, setContextOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

      {/* ── Center: chat ── */}
      <ChatArea
        contextOpen={contextOpen}
        onToggleContext={() => setContextOpen((v) => !v)}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />

      {/* ── Right: context (xl+) ── */}
      {contextOpen && <ContextPanel onClose={() => setContextOpen(false)} />}
    </div>
  );
}
