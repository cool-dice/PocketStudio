/**
 * Note isolation for agent tools — mirrors RAG workspace vs global chat.
 *
 * Workspace thread: only notes with a NoteLink to that project.
 * Global thread: all of this user's notes (optional filter by studio).
 * Never cross userId. Missing note in another studio → same "not found".
 */

export const NOTE_NOT_FOUND = "Заметка не найдена";

export function notesWhereForScope(
  userId: string,
  projectId: string | null,
): Record<string, unknown> {
  if (!projectId) return { userId };
  return { userId, links: { some: { projectId } } };
}

export function noteLinkedToProjectWhere(
  noteId: string,
  userId: string,
  projectId: string,
): Record<string, unknown> {
  return {
    id: noteId,
    userId,
    links: { some: { projectId } },
  };
}

/** True when a workspace thread must refuse a note that lives elsewhere. */
export function workspaceNoteIsOutOfScope(
  threadProjectId: string | null | undefined,
  linkedProjectIds: string[],
): boolean {
  if (!threadProjectId) return false;
  return !linkedProjectIds.includes(threadProjectId);
}
