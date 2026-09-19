"use client";

/**
 * AudioLibraryTab — библиотека аудио воркспейса: озвучки, DAW-миксы и
 * сэмплы. Карточки с <audio controls>-плеером, избранное (PATCH),
 * скачиванием и удалением артефакта.
 */

import { useCallback, useEffect, useState } from "react";
import { AudioWaveform, CircleAlert, Download, Loader2, RotateCw, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ArtifactDto } from "@/lib/workspace-types";
import { api, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNarrationDate, voiceLabel } from "./narration-data";

/** Бейдж происхождения трека: голос / микс DAW / сэмпл. */
function originBadge(artifact: ArtifactDto): { label: string; className: string } {
  const meta = artifact.meta as Record<string, unknown> | null;
  if (meta?.kind === "daw-mix") {
    return {
      label: "Микс DAW",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    };
  }
  if (typeof meta?.voice === "string") {
    return {
      label: voiceLabel(meta.voice),
      className: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
    };
  }
  return {
    label: "сэмпл",
    className: "border-stone-400/40 bg-stone-400/10 text-stone-600 dark:text-stone-400",
  };
}

export function AudioLibraryTab({
  projectId,
  refreshKey,
}: {
  projectId: string;
  /** Инкремент родителя — перезагрузка после нового микса/озвучки. */
  refreshKey: number;
}) {
  const [items, setItems] = useState<ArtifactDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listArtifacts(projectId, "audio");
      setItems(
        list
          .filter((a) => a.url)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось загрузить аудиотеку");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function toggleFavorite(artifact: ArtifactDto) {
    setPendingId(artifact.id);
    const next = !artifact.favorite;
    setItems((prev) =>
      prev.map((a) => (a.id === artifact.id ? { ...a, favorite: next } : a)),
    );
    try {
      const updated = await api.updateArtifact(artifact.id, { favorite: next });
      setItems((prev) => prev.map((a) => (a.id === artifact.id ? { ...a, ...updated } : a)));
    } catch {
      setItems((prev) =>
        prev.map((a) => (a.id === artifact.id ? { ...a, favorite: !next } : a)),
      );
      toast.error("Не удалось изменить избранное");
    } finally {
      setPendingId(null);
    }
  }

  async function remove(artifact: ArtifactDto) {
    setPendingId(artifact.id);
    try {
      await api.deleteArtifact(artifact.id);
      setItems((prev) => prev.filter((a) => a.id !== artifact.id));
      toast.success("Трек удалён", { description: `«${artifact.title}» убран из аудиотеки.` });
    } catch (err) {
      toast.error("Не удалось удалить", {
        description: err instanceof ApiError ? err.message : undefined,
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section aria-label="Аудиотека воркспейса" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold leading-tight">
          Аудиотека
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {items.length}
          </span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Обновить аудиотеку"
        >
          <RotateCw className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
          Обновить
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl opacity-60" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
            Попробовать снова
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <AudioWaveform className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-medium">Аудио пока нет</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Озвучьте текст во вкладке «Озвучка» или соберите трек в «Студии» —
            готовые записи и миксы появятся здесь.
          </p>
        </div>
      ) : (
        <ul className="max-h-[60dvh] space-y-2 overflow-y-auto vf-scroll pr-0.5">
          {items.map((artifact) => {
            const badge = originBadge(artifact);
            const date = formatNarrationDate(artifact.createdAt);
            return (
              <li
                key={artifact.id}
                className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  >
                    <AudioWaveform className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={artifact.title}>
                      {artifact.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={cn("text-[11px]", badge.className)}>
                        {badge.label}
                      </Badge>
                      {date ? (
                        <time
                          dateTime={artifact.createdAt}
                          className="text-xs text-muted-foreground"
                        >
                          {date}
                        </time>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => void toggleFavorite(artifact)}
                      disabled={pendingId === artifact.id}
                      aria-label={artifact.favorite ? "Убрать из избранного" : "Добавить в избранное"}
                      aria-pressed={artifact.favorite}
                    >
                      {pendingId === artifact.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Star
                          className={cn(
                            "size-4",
                            artifact.favorite
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground",
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8" asChild>
                      <a
                        href={artifact.url ?? undefined}
                        download
                        aria-label={`Скачать «${artifact.title}»`}
                      >
                        <Download className="size-4" aria-hidden="true" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => void remove(artifact)}
                      disabled={pendingId === artifact.id}
                      aria-label={`Удалить «${artifact.title}»`}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <audio
                  controls
                  preload="none"
                  src={artifact.url ?? undefined}
                  className="mt-3 h-10 w-full"
                  aria-label={`Плеер: ${artifact.title}`}
                />
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <CircleAlert className="size-3 shrink-0" aria-hidden="true" />
          Миксы из «Студии» и озвучки из «Озвучки» собираются здесь автоматически.
        </p>
      ) : null}
    </section>
  );
}
