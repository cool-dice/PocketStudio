"use client";

/**
 * Sync zustand mainArea / workspace id with the URL so chats and
 * workspaces are bookmarkable: /w/[id]?tab=… and /?area=…
 *
 * Store → URL runs when UI state changes. URL → store handles back/forward
 * so the browser history is not immediately overwritten.
 */

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { parseAppLocation, pathFor, TAB_SET, type AppLocation } from "@/lib/app-url";
import { useAppUi } from "@/lib/store";
import type { WorkspaceTab } from "@/lib/workspace-data";

function currentHref(pathname: string, searchParams: URLSearchParams): string {
  return `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
}

function applyLocationToStore(parsed: AppLocation): void {
  const s = useAppUi.getState();
  if (parsed.mainArea === "workspace" && parsed.workspaceId) {
    if (s.activeWorkspaceId !== parsed.workspaceId || s.mainArea !== "workspace") {
      s.openWorkspace(parsed.workspaceId, parsed.workspaceTab);
      return;
    }
    if (s.workspaceTab !== parsed.workspaceTab) {
      s.setWorkspaceTab(parsed.workspaceTab);
    }
    return;
  }
  if (s.mainArea === parsed.mainArea && !s.activeWorkspaceId) return;
  useAppUi.setState({
    mainArea: parsed.mainArea,
    activeWorkspaceId: null,
    activeWorkspaceOverride: null,
    workspaceTab: "chat",
  });
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
    applyLocationToStore(parseAppLocation(pathname, searchParams));
  }, [initialWorkspaceId, pathname, searchParams]);

  useEffect(() => {
    if (!hydrated.current) return;
    applyLocationToStore(parseAppLocation(pathname, searchParams));
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!hydrated.current) return;
    const next = pathFor(mainArea, workspaceId, workspaceTab);
    if (currentHref(pathname, searchParams) === next) return;
    router.replace(next, { scroll: false });
    // Pathname is read for the equality check but must NOT be a dependency:
    // a back/forward change updates the path first, while zustand still
    // holds the previous screen — replacing then would undo history.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [mainArea, workspaceId, workspaceTab, router]);

  return null;
}
