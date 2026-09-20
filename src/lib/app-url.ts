/**
 * Bookmarkable studio URLs: /w/[id]?tab=…&doc=… and /?area=…
 * Pure helpers so UrlSync and tests share one contract.
 */

import type { MainArea } from "@/lib/store";
import type { WorkspaceTab } from "@/lib/workspace-data";

export const AREA_SET = new Set<MainArea>([
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

export const TAB_SET = new Set<WorkspaceTab>([
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

export interface AppLocation {
  mainArea: MainArea;
  workspaceId: string | null;
  workspaceTab: WorkspaceTab;
  /** Last manuscript id when tab=documents (`?doc=`). */
  workspaceDocId: string | null;
}

export function isWorkspaceDocId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_-]{8,64}$/i.test(value);
}

export function parseAppLocation(
  pathname: string,
  search: URLSearchParams,
): AppLocation {
  const match = pathname.match(/^\/w\/([^/?#]+)/);
  if (match?.[1]) {
    const tabParam = search.get("tab");
    const tab =
      tabParam && TAB_SET.has(tabParam as WorkspaceTab)
        ? (tabParam as WorkspaceTab)
        : "chat";
    const docParam = search.get("doc");
    return {
      mainArea: "workspace",
      workspaceId: match[1],
      workspaceTab: tab,
      workspaceDocId:
        tab === "documents" && isWorkspaceDocId(docParam) ? docParam : null,
    };
  }
  const area = search.get("area");
  if (area && AREA_SET.has(area as MainArea)) {
    return {
      mainArea: area as MainArea,
      workspaceId: null,
      workspaceTab: "chat",
      workspaceDocId: null,
    };
  }
  return {
    mainArea: "chat",
    workspaceId: null,
    workspaceTab: "chat",
    workspaceDocId: null,
  };
}

export function pathFor(
  area: MainArea,
  workspaceId: string | null,
  tab: WorkspaceTab,
  docId?: string | null,
): string {
  if (area === "workspace" && workspaceId) {
    const params = new URLSearchParams();
    if (tab && tab !== "chat") params.set("tab", tab);
    if (tab === "documents" && isWorkspaceDocId(docId)) {
      params.set("doc", docId);
    }
    const qs = params.toString();
    return qs ? `/w/${workspaceId}?${qs}` : `/w/${workspaceId}`;
  }
  if (area === "chat" || area === "home") return "/";
  return `/?area=${area}`;
}

export function hrefFromLocation(loc: AppLocation): string {
  return pathFor(loc.mainArea, loc.workspaceId, loc.workspaceTab, loc.workspaceDocId);
}

/**
 * Sidebar «Чат»: inside a workspace stay on the scoped thread
 * (`/w/{id}` chat tab). From Home and other studio areas open the
 * unbound orchestrator (`/`).
 */
export function sidebarChatLocation(state: AppLocation): AppLocation {
  if (state.mainArea === "workspace" && state.workspaceId) {
    return {
      mainArea: "workspace",
      workspaceId: state.workspaceId,
      workspaceTab: "chat",
      workspaceDocId: null,
    };
  }
  return {
    mainArea: "chat",
    workspaceId: null,
    workspaceTab: "chat",
    workspaceDocId: null,
  };
}

export function isSidebarChatActive(state: AppLocation): boolean {
  if (state.mainArea === "chat") return true;
  return state.mainArea === "workspace" && state.workspaceTab === "chat";
}
