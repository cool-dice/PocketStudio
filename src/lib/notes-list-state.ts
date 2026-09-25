/**
 * Workspace notes tab: never paint another studio's leftover list as
 * this workspace's empty state, and never hide a fetch error as «нет мыслей».
 * Global notebook: a failed load is not «Пока пусто».
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

export type NotebookFeedView = "loading" | "error" | "empty" | "ready";

export function notebookFeedView(
  loading: boolean,
  loadError: string | null,
  noteCount: number,
): NotebookFeedView {
  if (loading) return "loading";
  if (loadError) return "error";
  if (noteCount === 0) return "empty";
  return "ready";
}

/**
 * Full NoteDetail lives in the chat/notebook context rail on xl+.
 * Workspace (and other studio areas) have no that rail — open a dialog
 * on every viewport so «открыть заметку» is not a dead click on desktop.
 */
export function noteDetailSurface(
  mainArea: string,
  isNarrow: boolean,
): "context-panel" | "dialog" {
  if (isNarrow) return "dialog";
  if (mainArea === "chat" || mainArea === "notebook") return "context-panel";
  return "dialog";
}
