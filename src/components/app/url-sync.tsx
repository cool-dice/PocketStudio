"use client";

/**
 * Sync zustand mainArea / workspace id with the URL so chats and
 * workspaces are bookmarkable: /w/[id]?tab=… and /?area=…
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useAppUi, type MainArea } from "@/lib/store";
import type { WorkspaceTab } from "@/lib/workspace-data";

const AREA_SET = new Set<MainArea>([
  "chat",
  "home",
  "workspaces",
  "notebook",
  "library",
  "tools",
  "deploy",
  "admin",
  "settings",
  "documents",
  "images",
  "design",
  "audio",
  "video",
  "mcp",
  "skills",
  "monetize",
  "projects",
]);

const TAB_SET = new Set<WorkspaceTab>([
  "overview",
  "chat",
  "notes",
  "documents",
  "images",
  "audio",
  "video",
  "code",
  "design",
  "deploy",
  "monetize",
]);

function pathFor(
  area: MainArea,
  workspaceId: string | null,
  tab: WorkspaceTab,
): string {
  if (area === "workspace" && workspaceId) {
    const qs = tab && tab !== "chat" ? `?tab=${tab}` : "";
    return `/w/${workspaceId}${qs}`;
  }
  if (area === "chat" || area === "home") return "/";
  return `/?area=${area}`;
}

export function UrlSync({
  initialWorkspaceId,
}: {
  initialWorkspaceId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mainArea = useAppUi((s) => s.mainArea);
  const workspaceId = useAppUi((s) => s.activeWorkspaceId);
  const workspaceTab = useAppUi((s) => s.workspaceTab);
  const hydrated = useRef(false);
  const writing = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const tabParam = searchParams.get("tab");
    const tab =
      tabParam && TAB_SET.has(tabParam as WorkspaceTab)
        ? (tabParam as WorkspaceTab)
        : "chat";
    if (initialWorkspaceId) {
      useAppUi.getState().openWorkspace(initialWorkspaceId, tab);
      return;
    }
    const area = searchParams.get("area");
    if (area && AREA_SET.has(area as MainArea)) {
      useAppUi.getState().setMainArea(area as MainArea);
    }
  }, [initialWorkspaceId, searchParams]);

  useEffect(() => {
    if (!hydrated.current) return;
    const next = pathFor(mainArea, workspaceId, workspaceTab);
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (current === next) return;
    writing.current = true;
    router.replace(next, { scroll: false });
  }, [mainArea, workspaceId, workspaceTab, pathname, router, searchParams]);

  return null;
}
