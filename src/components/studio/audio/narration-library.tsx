"use client";

/**
 * NarrationLibrary — живая библиотека озвучек (Фаза A).
 *
 * api.listArtifacts(workspaceId, "audio") + type "track" — карточки с
 * настоящим <audio controls>-плеером (файлы /gen/*.wav), названием,
 * голосом из meta.voice, датой и избранным (api.updateArtifact).
 */

import { useCallback, useEffect, useState } from "react";
import { AudioWaveform, Loader2, RotateCw, Star } from "lucide-react";
import { toast } from "sonner";

import type { ArtifactDto } from "@/lib/workspace-types";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNarrationDate, voiceLabel } from "./narration-data";

/** «45 симв.» для счётчика из meta.chars. */
function charsLabel(meta: ArtifactDto["meta"]): string | null {
  const chars = (meta as Record<string, unknown> | null)?.chars;
  return typeof chars === "number" && chars > 0 ? `${chars} симв.` : null;
}

export function NarrationLibrary({
  workspaceId,
  refreshKey,
}: {
  workspaceId: string;
  /** Инкремент родителя — перезагрузка после новой озвучки. */
  refreshKey: number;
}) {
  const [tracks, setTracks] = useState<ArtifactDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingFavId, setPendingFavId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Озвучки (type=audio) + редкие «треки» (type=track), дедуп по id.
      const [audio, track] = await Promise.all([
        api.listArtifacts(workspaceId, "audio"),
        api.listArtifacts(workspaceId, "track"),
      ]);
      const byId = new Map<string, ArtifactDto>();
      for (const a of [...audio, ...track]) {
        if (a.url) byId.set(a.id, a);
      }
      const merged = [...byId.values()].sort(
        (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
      );
      setTracks(merged);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Не удалось загрузить библиотеку озвучек",
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function toggleFavorite(track: ArtifactDto) {
    setPendingFavId(track.id);
    const next = !track.favorite;
    // Оптимистично — откат при ошибке.
    setTracks((prev) =>
      prev.map((t) => (t.id === track.id ? { ...t, favorite: next } : t)),
    );
    try {
      const updated = await api.updateArtifact(track.id, { favorite: next });
      setTracks((prev) => prev.map((t) => (t.id === track.id ? { ...t, ...updated } : t)));
    } catch {
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, favorite: !next } : t)),
      );
      toast.error("Не удалось изменить избранное");
    } finally {
      setPendingFavId(null);
    }
  }

  return (
    <section aria-label="Библиотека озвучек" className="shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold leading-tight">
          Библиотека озвучек
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {tracks.length}
          </span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Обновить библиотеку"
        >
          <RotateCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
          Обновить
        </Button>
      </div>

      {loading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl opacity-60" />
        </div>
      ) : error ? (
        <div className="mt-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
            Попробовать снова
          </Button>
        </div>
      ) : tracks.length === 0 ? (
        <div className="mt-2 rounded-xl border border-dashed p-6 text-center">
          <AudioWaveform className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Озвучек пока нет</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Напишите текст выше и нажмите «Озвучить» — трек появится здесь.
          </p>
        </div>
      ) : (
        <ul className="mt-2 space-y-2">
          {tracks.map((track) => {
            const date = formatNarrationDate(track.createdAt);
            const chars = charsLabel(track.meta);
            return (
              <li
                key={track.id}
                className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  >
                    <AudioWaveform className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={track.title}>
                      {track.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{voiceLabel((track.meta as Record<string, unknown> | null)?.voice)}</span>
                      {date ? <span aria-hidden="true">·</span> : null}
                      {date ? <time dateTime={track.createdAt}>{date}</time> : null}
                      {chars ? <span aria-hidden="true">·</span> : null}
                      {chars ? <span>{chars}</span> : null}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => void toggleFavorite(track)}
                    disabled={pendingFavId === track.id}
                    aria-label={track.favorite ? "Убрать из избранного" : "Добавить в избранное"}
                    aria-pressed={track.favorite}
                  >
                    {pendingFavId === track.id ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Star
                        className={cn(
                          "size-4",
                          track.favorite
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </Button>
                </div>
                {/* Настоящий плеер: файл лежит в /gen/<uuid>.wav */}
                <audio
                  controls
                  preload="metadata"
                  src={track.url ?? undefined}
                  className="mt-3 h-10 w-full"
                  aria-label={`Плеер: ${track.title}`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
