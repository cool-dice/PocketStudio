"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Scissors, Magnet, Film } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { compileFilm, filmRenderSupported } from "./film-compiler";
import {
  DEFAULT_LUTS,
  emptyTimeline,
  timelineDuration,
  type NleClip,
  type NleTimeline,
} from "@/lib/nle-model";
import type { ArtifactDto } from "@/lib/workspace-types";
import { cn } from "@/lib/utils";

const PX_PER_SEC = 24;

export function NleTimeline({
  workspaceId,
  artifacts,
}: {
  workspaceId: string;
  artifacts: ArtifactDto[];
}) {
  const [tl, setTl] = useState<NleTimeline>(emptyTimeline());
  const [selected, setSelected] = useState<string | null>(null);
  const [snap, setSnap] = useState(true);
  const [razor, setRazor] = useState(false);
  const [compiling, setCompiling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getTimeline(workspaceId);
      setTl(res.timeline);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось открыть монтаж");
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const duration = Math.max(12, timelineDuration(tl) + 4);
  const media = useMemo(
    () =>
      artifacts.filter(
        (a) =>
          a.type === "image" ||
          a.type === "audio" ||
          a.type === "video" ||
          a.type === "scene" ||
          a.type === "portrait",
      ),
    [artifacts],
  );

  function addClip(trackId: string, artifact: ArtifactDto) {
    const track = tl.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const start = snap
      ? Math.round(
          track.clips.reduce(
            (m, c) => Math.max(m, c.start + (c.outPoint - c.inPoint)),
            0,
          ),
        )
      : track.clips.reduce(
          (m, c) => Math.max(m, c.start + (c.outPoint - c.inPoint)),
          0,
        );
    const clip: NleClip = {
      id: `clip-${Date.now().toString(36)}`,
      artifactId: artifact.id,
      title: artifact.title,
      start,
      inPoint: 0,
      outPoint: artifact.type === "audio" ? 8 : 4,
      url: artifact.url,
      type:
        artifact.type === "audio"
          ? "audio"
          : artifact.type === "video"
            ? "video"
            : "image",
      speed: 1,
      lut: null,
      transition: "cut",
      kenBurns: true,
    };
    setTl((p) => ({
      ...p,
      tracks: p.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
      ),
    }));
  }

  function splitSelected() {
    if (!selected) return;
    setTl((p) => ({
      ...p,
      tracks: p.tracks.map((t) => ({
        ...t,
        clips: t.clips.flatMap((c) => {
          if (c.id !== selected) return [c];
          const mid = (c.inPoint + c.outPoint) / 2;
          return [
            { ...c, outPoint: mid },
            {
              ...c,
              id: `${c.id}-b`,
              start: c.start + (mid - c.inPoint),
              inPoint: mid,
            },
          ];
        }),
      })),
    }));
  }

  const selectedClip = tl.tracks.flatMap((t) => t.clips).find((c) => c.id === selected);

  async function save() {
    try {
      await api.saveTimeline(workspaceId, { timeline: tl, fps: tl.fps });
      toast.success("Таймлайн сохранён");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Не удалось сохранить монтаж");
    }
  }

  async function assemble() {
    const v1 = tl.tracks.find((t) => t.id === "v1");
    const clips = [...(v1?.clips ?? [])].sort((a, b) => a.start - b.start);
    if (clips.length === 0) {
      toast.message("Нет клипов на V1 — добавьте кадры из медиатеки");
      return;
    }
    const a1 = tl.tracks.find((t) => t.id === "a1")?.clips ?? [];
    const scenes = clips
      .map((c, i) => ({
        imageUrl: c.url,
        audioUrl: a1[i]?.url ?? null,
        title: c.title,
        text: c.title,
      }))
      .filter((s) => Boolean(s.imageUrl));
    if (scenes.length === 0) {
      toast.error("У клипов на V1 нет файлов — сборка невозможна");
      return;
    }
    setCompiling(true);
    try {
      const ff = await api.compileFilmFfmpeg(workspaceId, {
        clips: scenes.map((s) => ({ imageUrl: s.imageUrl, durationSec: 4 })),
      });
      if (ff.status === "built" && ff.url) {
        toast.success("ffmpeg собрал WebM");
        const a = document.createElement("a");
        a.href = ff.url;
        a.download = "montage-ffmpeg.webm";
        a.click();
        return;
      }
      toast.message(
        ff.log?.slice(0, 140) || "ffmpeg недоступен — собираю в браузере",
      );
      const compiled = await compileFilm(scenes, {
        width: 854,
        height: 480,
        showTitles: true,
      });
      await api.uploadArtifact(workspaceId, {
        blob: compiled.blob,
        type: "video",
        title: "Монтаж NLE",
        description: "Сборка монтажного стола (Ken Burns, сцены V1)",
        stage: "Монтаж",
        meta: { source: "nle", clips: clips.length, durationSec: compiled.durationSec },
      });
      const url = URL.createObjectURL(compiled.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "montage.webm";
      a.click();
      toast.success("WebM собран и сохранён в библиотеку");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось собрать фильм");
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={razor ? "default" : "outline"}
          onClick={() => {
            setRazor((v) => !v);
            splitSelected();
          }}
        >
          <Scissors className="size-3.5" /> Бритва
        </Button>
        <Button
          size="sm"
          variant={snap ? "default" : "outline"}
          onClick={() => setSnap((v) => !v)}
        >
          <Magnet className="size-3.5" /> Магнит
        </Button>
        <Button size="sm" onClick={() => void save()}>
          Сохранить монтаж
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={compiling || !filmRenderSupported()}
          onClick={() => void assemble()}
        >
          <Film className="size-3.5" /> {compiling ? "Сборка…" : "Собрать"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Цель 10–20 мин, перспектива до 2 ч · сейчас {duration.toFixed(0)} с
        </span>
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="w-44 shrink-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Медиатека</p>
          <ul className="vf-scroll max-h-64 space-y-1 overflow-y-auto">
            {media.length === 0 ? (
              <li className="text-xs text-muted-foreground">Нет кадров и озвучки</li>
            ) : (
              media.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className="w-full truncate rounded-lg border px-2 py-1.5 text-left text-xs hover:border-primary/40"
                    onClick={() => addClip("v1", a)}
                    title="На V1"
                  >
                    {a.title}
                  </button>
                </li>
              ))
            )}
          </ul>
          {selectedClip ? (
            <div className="space-y-1 rounded-lg border p-2 text-xs">
              <p className="font-medium">{selectedClip.title}</p>
              <label className="block">
                Скорость
                <input
                  type="range"
                  min={0.5}
                  max={2}
                  step={0.25}
                  value={selectedClip.speed}
                  onChange={(e) => {
                    const speed = Number(e.target.value);
                    setTl((p) => ({
                      ...p,
                      tracks: p.tracks.map((t) => ({
                        ...t,
                        clips: t.clips.map((c) =>
                          c.id === selectedClip.id ? { ...c, speed } : c,
                        ),
                      })),
                    }));
                  }}
                  className="w-full"
                />
              </label>
              <label className="block">
                LUT
                <select
                  className="mt-1 w-full rounded border bg-background p-1"
                  value={selectedClip.lut ?? "none"}
                  onChange={(e) => {
                    const lut = e.target.value === "none" ? null : e.target.value;
                    setTl((p) => ({
                      ...p,
                      tracks: p.tracks.map((t) => ({
                        ...t,
                        clips: t.clips.map((c) =>
                          c.id === selectedClip.id ? { ...c, lut } : c,
                        ),
                      })),
                    }));
                  }}
                >
                  {DEFAULT_LUTS.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={selectedClip.kenBurns !== false}
                  onChange={(e) => {
                    const kenBurns = e.target.checked;
                    setTl((p) => ({
                      ...p,
                      tracks: p.tracks.map((t) => ({
                        ...t,
                        clips: t.clips.map((c) =>
                          c.id === selectedClip.id ? { ...c, kenBurns } : c,
                        ),
                      })),
                    }));
                  }}
                />
                Ken Burns
              </label>
            </div>
          ) : null}
        </aside>
        <div className="vf-scroll min-w-0 flex-1 overflow-auto rounded-xl border bg-card p-2">
          {tl.tracks.map((track) => (
            <div key={track.id} className="mb-2 flex items-stretch gap-2">
              <div className="w-12 shrink-0 pt-1 text-[11px] font-medium text-muted-foreground">
                {track.name}
              </div>
              <div
                className="relative h-10 flex-1 rounded bg-muted/60"
                style={{ width: duration * PX_PER_SEC }}
                onDragOver={(e) => e.preventDefault()}
              >
                {track.clips.map((clip) => (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => {
                      setSelected(clip.id);
                      if (razor) splitSelected();
                    }}
                    className={cn(
                      "absolute top-1 h-8 truncate rounded px-1 text-[10px] text-white",
                      selected === clip.id ? "ring-2 ring-white" : "",
                    )}
                    style={{
                      left: clip.start * PX_PER_SEC,
                      width: Math.max(
                        24,
                        ((clip.outPoint - clip.inPoint) / (clip.speed || 1)) * PX_PER_SEC,
                      ),
                      background:
                        track.kind === "audio"
                          ? "#d97706"
                          : track.kind === "titles"
                            ? "#7c3aed"
                            : "#0d9488",
                    }}
                  >
                    {clip.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
