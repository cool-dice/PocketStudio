/**
 * Bookmarkable studio URLs: /w/[id]?tab=… and /?area=…
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
    return {
      mainArea: "workspace",
      workspaceId: match[1],
      workspaceTab: tab,
    };
  }
  const area = search.get("area");
  if (area && AREA_SET.has(area as MainArea)) {
    return { mainArea: area as MainArea, workspaceId: null, workspaceTab: "chat" };
  }
  return { mainArea: "chat", workspaceId: null, workspaceTab: "chat" };
}

export function pathFor(
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
