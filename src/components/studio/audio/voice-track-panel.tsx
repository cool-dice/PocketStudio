"use client";

/**
 * VoiceTrackPanel — редактор голосовой дорожки: выбор аудио-артефакта
 * воркспейса (озвучки из вкладки «Озвучка»), превью-плеер и шаг старта.
 */

import { useEffect, useState } from "react";
import { FileAudio, Mic } from "lucide-react";

import type { ArtifactDto } from "@/lib/workspace-types";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VoiceClip } from "@/lib/daw-model";

export function VoiceTrackPanel({
  projectId,
  clip,
  totalSteps,
  onChange,
}: {
  projectId: string;
  clip: VoiceClip | undefined;
  totalSteps: number;
  onChange: (clip: VoiceClip | undefined) => void;
}) {
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);
  /** Воркспейс, для которого список уже загружен (null — грузим). */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listArtifacts(projectId, "audio")
      .then((list) => {
        if (!cancelled) {
          setArtifacts(list.filter((a) => a.url));
          setLoadedFor(projectId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setArtifacts([]);
          setLoadedFor(projectId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const maxStep = Math.max(0, totalSteps - 1);
  const ready = loadedFor === projectId;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <label className="flex min-w-0 flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Аудио воркспейса</span>
        {!ready ? (
          <Skeleton className="h-9 w-full max-w-sm rounded-md" />
        ) : (
          <Select
            value={clip?.artifactId ?? ""}
            onValueChange={(artifactId) => {
              const found = artifacts.find((a) => a.id === artifactId);
              if (!found?.url) return;
              onChange({
                artifactId: found.id,
                artifactTitle: found.title,
                artifactUrl: found.url,
                step: clip?.step ?? 0,
              });
            }}
          >
            <SelectTrigger className="w-full max-w-sm" aria-label="Аудио-артефакт">
              <SelectValue
                placeholder={artifacts.length === 0 ? "Нет аудио в воркспейсе" : "Выберите озвучку…"}
              />
            </SelectTrigger>
            <SelectContent>
              {artifacts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </label>

      {clip ? (
        <div className="flex flex-col gap-2.5 rounded-lg border bg-background/50 p-3">
          <p className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <FileAudio className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{clip.artifactTitle}</span>
          </p>
          <audio
            controls
            preload="metadata"
            src={clip.artifactUrl}
            className="h-10 w-full"
            aria-label={`Превью: ${clip.artifactTitle}`}
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Шаг старта (0…{maxStep})
              </span>
              <Input
                type="number"
                min={0}
                max={maxStep}
                value={clip.step}
                onChange={(e) => {
                  const raw = Number(e.target.value);
                  const step = Number.isFinite(raw)
                    ? Math.min(maxStep, Math.max(0, Math.round(raw)))
                    : 0;
                  onChange({ ...clip, step });
                }}
                className="h-9 w-24 tabular-nums"
                aria-label="Шаг старта клипа"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange(undefined)}
              className="text-muted-foreground"
            >
              Убрать клип
            </Button>
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
          <Mic className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Озвучки делаются во вкладке «Озвучка» — готовый трек появится в этом
          списке и встанет на сетку студии.
        </p>
      )}
    </div>
  );
}
