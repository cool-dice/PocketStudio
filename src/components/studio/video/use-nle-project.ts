"use client";

/**
 * Состояние монтажного проекта (NLE): клипы, дорожки, плейхед,
 * инструменты. Все мутации локальные — «бритва» реально делит клип,
 * удаление/скорость/LUT/титры живут в одном сторе вкладки «Монтаж».
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  INITIAL_PLAYHEAD,
  RULER_SECONDS,
  buildInitialClips,
  trackForItem,
  TRACKS,
  type MediaItem,
  type NleClip,
  type TitlePosition,
  type TrackId,
  type TransitionId,
  type FontId,
  type LutId,
} from "./nle-data";

export type NleTool = "select" | "razor" | "trim";

export interface TrackRuntime {
  id: TrackId;
  muted: boolean;
  hidden: boolean;
  locked: boolean;
  volume: number;
}

function initialTrackState(): Record<TrackId, TrackRuntime> {
  return Object.fromEntries(
    TRACKS.map((t) => [
      t.id,
      { id: t.id, muted: false, hidden: false, locked: false, volume: t.volume },
    ]),
  ) as Record<TrackId, TrackRuntime>;
}

export function useNleProject() {
  const [clips, setClips] = useState<NleClip[]>(() => buildInitialClips());
  const [trackState, setTrackState] =
    useState<Record<TrackId, TrackRuntime>>(initialTrackState);
  const [selectedId, setSelectedId] = useState<string | null>("c3");
  const [playhead, setPlayhead] = useState(INITIAL_PLAYHEAD);
  const [playing, setPlaying] = useState(false);
  const [tool, setTool] = useState<NleTool>("select");
  const [snapping, setSnapping] = useState(true);
  const [zoom, setZoom] = useState(1);

  const idRef = useRef(100);
  const nid = useCallback(() => `n${++idRef.current}`, []);

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedId) ?? null,
    [clips, selectedId],
  );

  const clipsByTrack = useMemo(() => {
    const map = Object.fromEntries(
      TRACKS.map((t) => [t.id, [] as NleClip[]]),
    ) as Record<TrackId, NleClip[]>;
    for (const clip of clips) map[clip.trackId].push(clip);
    for (const id of Object.keys(map) as TrackId[])
      map[id].sort((a, b) => a.start - b.start);
    return map;
  }, [clips]);

  /** Конец шкалы: не меньше 15 минут и хвоста под добавленные клипы. */
  const timelineEnd = useMemo(() => {
    let max = RULER_SECONDS;
    for (const c of clips) max = Math.max(max, c.start + c.duration + 24);
    return max;
  }, [clips]);

  /** Конец фактического контента — во столько зацикливается воспроизведение. */
  const contentEnd = useMemo(() => {
    let max = 1;
    for (const c of clips) max = Math.max(max, c.start + c.duration);
    return max;
  }, [clips]);

  /* ── Воспроизведение ─────────────────────────────────────────────── */

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setPlayhead((p) => (p + 0.25 >= contentEnd ? 0 : p + 0.25));
    }, 250);
    return () => window.clearInterval(timer);
  }, [playing, contentEnd]);

  const togglePlaying = useCallback(() => {
    if (!playing && playhead >= contentEnd - 0.5) setPlayhead(0);
    setPlaying((p) => !p);
  }, [playing, playhead, contentEnd]);

  const seekTo = useCallback(
    (seconds: number) => {
      setPlayhead(Math.min(Math.max(seconds, 0), timelineEnd));
    },
    [timelineEnd],
  );

  const skipToStart = useCallback(() => seekTo(0), [seekTo]);
  const skipToEnd = useCallback(
    () => seekTo(contentEnd - 0.04),
    [seekTo, contentEnd],
  );

  /* ── Клипы ────────────────────────────────────────────────────────── */

  const selectClip = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  /** «Бритва»: делит клип в пропорции ratio (0..1) от начала. */
  const splitClip = useCallback(
    (id: string, ratio: number): boolean => {
      const clip = clips.find((c) => c.id === id);
      if (!clip) return false;
      if (trackState[clip.trackId].locked) return false;
      const r = Math.min(Math.max(ratio, 0.08), 0.92);
      const leftDur = clip.duration * r;
      const rightDur = clip.duration - leftDur;
      setClips((prev) => {
        const next: NleClip[] = [];
        for (const c of prev) {
          if (c.id !== id) {
            next.push(c);
            continue;
          }
          next.push({ ...c, duration: leftDur });
          next.push({
            ...c,
            id: nid(),
            start: c.start + leftDur,
            duration: rightDur,
            inPoint: c.inPoint + leftDur,
            transition: null,
          });
        }
        return next;
      });
      return true;
    },
    [clips, trackState, nid],
  );

  /** Удаляет выбранный клип. false — дорожка заблокирована. */
  const removeSelected = useCallback((): boolean => {
    if (!selectedClip) return false;
    if (trackState[selectedClip.trackId].locked) return false;
    setClips((prev) => prev.filter((c) => c.id !== selectedClip.id));
    setSelectedId(null);
    return true;
  }, [selectedClip, trackState]);

  /** Добавляет элемент медиатеки в конец своей дорожки. */
  const addMediaClip = useCallback(
    (item: MediaItem): TrackId | null => {
      const trackId = trackForItem(item);
      if (trackState[trackId].locked) return null;
      const lane = clips.filter((c) => c.trackId === trackId);
      const start = lane.reduce((acc, c) => Math.max(acc, c.start + c.duration), 0);
      const clip: NleClip = {
        id: nid(),
        trackId,
        kind: item.type,
        name: item.name,
        start: Math.round(start),
        duration: item.duration,
        inPoint: 0,
        gradient: item.gradient,
        icon: item.icon,
        speed: 1,
        lut: null,
        transition: null,
        ...(item.type === "title"
          ? { text: item.name.replace(/^Титр — /, ""), font: "serif" as FontId, size: 32, position: "center" as TitlePosition }
          : {}),
      };
      setClips((prev) => [...prev, clip]);
      setSelectedId(clip.id);
      return trackId;
    },
    [clips, trackState, nid],
  );

  const updateClip = useCallback(
    (id: string, patch: Partial<NleClip>) => {
      setClips((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  /** Скорость: длительность клипа пересчитывается обратно пропорционально. */
  const setSpeed = useCallback(
    (id: string, speed: number) => {
      setClips((prev) =>
        prev.map((c) => {
          if (c.id !== id || c.speed === speed) return c;
          return { ...c, speed, duration: (c.duration * c.speed) / speed };
        }),
      );
    },
    [],
  );

  const setLut = useCallback(
    (id: string, lut: LutId | null) => updateClip(id, { lut }),
    [updateClip],
  );

  const setTransition = useCallback(
    (id: string, transition: TransitionId | null) =>
      updateClip(id, { transition }),
    [updateClip],
  );

  const setTitleText = useCallback(
    (id: string, text: string) => updateClip(id, { text }),
    [updateClip],
  );

  const setTitleProps = useCallback(
    (id: string, patch: { font?: FontId; size?: number; position?: TitlePosition }) =>
      updateClip(id, patch),
    [updateClip],
  );

  /* ── Дорожки ──────────────────────────────────────────────────────── */

  const toggleTrackFlag = useCallback(
    (id: TrackId, flag: "muted" | "hidden" | "locked") => {
      setTrackState((prev) => ({
        ...prev,
        [id]: { ...prev[id], [flag]: !prev[id][flag] },
      }));
    },
    [],
  );

  const setTrackVolume = useCallback((id: TrackId, volume: number) => {
    setTrackState((prev) => ({ ...prev, [id]: { ...prev[id], volume } }));
  }, []);

  /* ── Кадр под плейхедом (для программного монитора) ────────────────── */

  const frameClip = useMemo(() => {
    if (trackState.v1.hidden) return null;
    return (
      clips.find(
        (c) =>
          c.trackId === "v1" &&
          playhead >= c.start &&
          playhead < c.start + c.duration,
      ) ?? null
    );
  }, [clips, playhead, trackState.v1.hidden]);

  const overlayTitle = useMemo(() => {
    if (trackState.titles.hidden) return null;
    return (
      clips.find(
        (c) =>
          c.trackId === "titles" &&
          playhead >= c.start &&
          playhead < c.start + c.duration,
      ) ?? null
    );
  }, [clips, playhead, trackState.titles.hidden]);

  return {
    clips,
    clipsByTrack,
    trackState,
    selectedId,
    selectedClip,
    playhead,
    playing,
    tool,
    snapping,
    zoom,
    timelineEnd,
    frameClip,
    overlayTitle,
    setTool,
    setSnapping,
    setZoom,
    setPlaying,
    selectClip,
    togglePlaying,
    seekTo,
    skipToStart,
    skipToEnd,
    splitClip,
    removeSelected,
    addMediaClip,
    updateClip,
    setSpeed,
    setLut,
    setTransition,
    setTitleText,
    setTitleProps,
    toggleTrackFlag,
    setTrackVolume,
  };
}

export type NleProject = ReturnType<typeof useNleProject>;
