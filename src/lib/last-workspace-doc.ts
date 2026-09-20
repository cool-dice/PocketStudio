/**
 * Last open manuscript in a workspace. URL `?doc=` is primary;
 * localStorage covers reload on another tab of the same workspace.
 */

import { isWorkspaceDocId } from "@/lib/app-url";

export function lastDocStorageKey(workspaceId: string): string {
  return `ps:last-doc:${workspaceId}`;
}

type Kv = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): Kv | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readLastWorkspaceDoc(
  workspaceId: string,
  storage: Kv | null = browserStorage(),
): string | null {
  if (!storage || !workspaceId) return null;
  try {
    const raw = storage.getItem(lastDocStorageKey(workspaceId));
    return isWorkspaceDocId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeLastWorkspaceDoc(
  workspaceId: string,
  docId: string | null,
  storage: Kv | null = browserStorage(),
): void {
  if (!storage || !workspaceId) return;
  try {
    const key = lastDocStorageKey(workspaceId);
    if (docId && isWorkspaceDocId(docId)) storage.setItem(key, docId);
    else storage.removeItem(key);
  } catch {
    /* private mode */
  }
}
