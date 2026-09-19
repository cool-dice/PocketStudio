"use client";

/**
 * Picker: copy a library image into this workspace album.
 * Candidates are visual artifacts from other workspaces; attach is POST {sourceId}.
 */

import { ImageIcon, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, ApiError } from "@/lib/api";
import {
  ALBUM_ADD_FAILED,
  ALBUM_ADD_OK,
  ALBUM_LIBRARY_EMPTY,
  ALBUM_LIBRARY_EMPTY_HINT,
  ALBUM_LIBRARY_LOAD_ERROR,
  ALBUM_MISSING_FILE,
} from "@/lib/album-copy";
import type { ArtifactDto } from "@/lib/workspace-types";
import { isAlbumArtifact } from "./album-data";

export function AlbumLibraryDialog({
  open,
  onOpenChange,
  workspaceId,
  alreadyIds,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  alreadyIds: Set<string>;
  onAdded: (artifact: ArtifactDto) => void;
}) {
  const [candidates, setCandidates] = useState<ArtifactDto[]>([]);
  const [workspaceNames, setWorkspaceNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    Promise.all([api.listAllArtifacts(), api.listWorkspaces()])
      .then(([arts, workspaces]) => {
        if (cancelled) return;
        setCandidates(arts.filter(isAlbumArtifact));
        setWorkspaceNames(new Map(workspaces.map((ws) => [ws.id, ws.name])));
      })
      .catch(() => {
        if (!cancelled) {
          setCandidates([]);
          setLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const visible = useMemo(
    () =>
      candidates.filter(
        (artifact) =>
          artifact.projectId !== workspaceId && !alreadyIds.has(artifact.id),
      ),
    [candidates, workspaceId, alreadyIds],
  );

  async function handleAdd(source: ArtifactDto) {
    if (addingId) return;
    setAddingId(source.id);
    try {
      const copied = await api.addAlbumFromLibrary(workspaceId, source.id);
      onAdded(copied);
      toast.success(ALBUM_ADD_OK, { description: copied.title });
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : ALBUM_ADD_FAILED,
      );
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-3">
        <DialogHeader>
          <DialogTitle>Из библиотеки</DialogTitle>
          <DialogDescription>
            Картинка копируется в альбом этого воркспейса. Оригинал остаётся на месте.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Загрузка библиотеки…
          </div>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {ALBUM_LIBRARY_LOAD_ERROR}
          </p>
        ) : visible.length === 0 ? (
          <div className="space-y-1 py-8 text-center">
            <p className="text-sm font-medium">{ALBUM_LIBRARY_EMPTY}</p>
            <p className="text-xs text-muted-foreground">{ALBUM_LIBRARY_EMPTY_HINT}</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[min(24rem,50vh)] pr-3">
            <ul className="space-y-2">
              {visible.map((artifact) => {
                const missing = Boolean(artifact.fileMissing) || !artifact.url;
                return (
                  <li key={artifact.id}>
                    <button
                      type="button"
                      disabled={addingId !== null}
                      onClick={() => void handleAdd(artifact)}
                      className="flex w-full items-center gap-3 rounded-xl border bg-card p-2 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
                    >
                      {artifact.url && !artifact.fileMissing ? (
                        <img
                          src={artifact.url}
                          alt=""
                          className="size-12 shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <ImageIcon className="size-5" aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {artifact.title}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {workspaceNames.get(artifact.projectId) ?? "Другой воркспейс"}
                          {missing ? ` · ${ALBUM_MISSING_FILE}` : ""}
                        </span>
                      </span>
                      {addingId === artifact.id ? (
                        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
