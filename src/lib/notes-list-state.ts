/**
 * Workspace notes tab: never paint another studio's leftover list as
 * this workspace's empty state, and never hide a fetch error as «нет мыслей».
 */

export type NotesListView = "loading" | "error" | "ready";

export function notesListViewState(
  workspaceId: string,
  loadedWorkspaceId: string | null,
  errorWorkspaceId: string | null,
): NotesListView {
  if (errorWorkspaceId === workspaceId) return "error";
  if (loadedWorkspaceId === workspaceId) return "ready";
  return "loading";
}
