"use client";

import { useMemo, useState } from "react";
import { Layers, Loader2, MoreHorizontal, Pause, Play, Search, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SelectableChip } from "./chip";
import {
  formatTime,
  TRACK_MOODS,
  TRACK_STATUS_META,
  TRACK_TYPE_DOT,
  TRACK_TYPE_LABEL,
  type AudioTrack,
  type TrackMood,
} from "./tracks-data";

type SortKey = "date" | "title" | "duration";
type BpmFilter = "all" | "lt90" | "90to120" | "gt120";

/**
 * Библиотека дорожек с каталогизацией: поиск, чипы настроения
 * со счётчиками, фильтры тональности и BPM, сортировка,
 * избранное и «Разложить в студии».
 */
export function TrackLibrary({
  tracks,
  currentId,
  playing,
  explodingTitle,
  onTogglePlay,
  onSelect,
  onExplodeToStems,
}: {
  tracks: AudioTrack[];
  currentId: string;
  playing: boolean;
  explodingTitle: string | null;
  onTogglePlay: (id: string) => void;
  onSelect: (id: string) => void;
  onExplodeToStems: (track: AudioTrack) => void;
}) {
  const [query, setQuery] = useState("");
  const [mood, setMood] = useState<TrackMood | "all">("all");
  const [keyFilter, setKeyFilter] = useState("all");
  const [bpmFilter, setBpmFilter] = useState<BpmFilter>("all");
  const [sort, setSort] = useState<SortKey>("date");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set(["trk-02"]));

  const keys = useMemo(
    () => [...new Set(tracks.map((t) => t.key).filter((k) => k !== "—"))].sort(),
    [tracks],
  );

  const byMoodKeyBpm = useMemo(
    () =>
      tracks.filter(
        (t) =>
          (mood === "all" || t.mood === mood) &&
          (keyFilter === "all" || t.key === keyFilter) &&
          (bpmFilter === "all" ||
            (bpmFilter === "lt90" && t.bpm < 90) ||
            (bpmFilter === "90to120" && t.bpm >= 90 && t.bpm <= 120) ||
            (bpmFilter === "gt120" && t.bpm > 120)),
      ),
    [tracks, mood, keyFilter, bpmFilter],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = byMoodKeyBpm.filter(
      (t) =>
        (!q || t.title.toLowerCase().includes(q) || t.meta.toLowerCase().includes(q)) &&
        (!favoritesOnly || favorites.has(t.id)),
    );
    const sorted = [...list];
    if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    if (sort === "date") sorted.sort((a, b) => b.createdAtMs - a.createdAtMs);
    if (sort === "duration") sorted.sort((a, b) => b.durationSec - a.durationSec);
    return sorted;
  }, [byMoodKeyBpm, query, favoritesOnly, favorites, sort]);

  const moodCount = (m: TrackMood) => byMoodKeyBpm.filter((t) => t.mood === m).length;

  const toggleFavorite = (id: string) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Библиотека</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {visible.length} из {tracks.length} дорожек
        </span>
      </div>

      {/* Каталогизация: поиск + фильтры + сортировка */}
      <div className="shrink-0 space-y-2 rounded-xl border bg-card/60 p-2.5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по названию или описанию…"
              className="h-8 pl-8 text-xs"
              aria-label="Поиск по библиотеке"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <SelectableChip
            label="Все"
            selected={mood === "all" && !favoritesOnly}
            onClick={() => {
              setMood("all");
              setFavoritesOnly(false);
            }}
            count={byMoodKeyBpm.length}
          />
          {TRACK_MOODS.map((m) => (
            <SelectableChip
              key={m}
              label={m.toLowerCase()}
              selected={mood === m && !favoritesOnly}
              onClick={() => {
                setMood(mood === m ? "all" : m);
                setFavoritesOnly(false);
              }}
              count={moodCount(m)}
            />
          ))}
          <SelectableChip
            label="Избранное"
            icon={Star}
            selected={favoritesOnly}
            onClick={() => setFavoritesOnly((f) => !f)}
            count={favorites.size}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={keyFilter} onValueChange={setKeyFilter}>
            <SelectTrigger className="h-8 flex-1 min-w-28 text-xs" aria-label="Фильтр по тональности">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все тональности</SelectItem>
              {keys.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bpmFilter} onValueChange={(v) => setBpmFilter(v as BpmFilter)}>
            <SelectTrigger className="h-8 flex-1 min-w-28 text-xs" aria-label="Фильтр по темпу">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Любой BPM</SelectItem>
              <SelectItem value="lt90">до 90</SelectItem>
              <SelectItem value="90to120">90–120</SelectItem>
              <SelectItem value="gt120">120+</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 flex-1 min-w-32 text-xs" aria-label="Сортировка">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Сначала новые</SelectItem>
              <SelectItem value="title">По названию</SelectItem>
              <SelectItem value="duration">По длительности</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="shrink-0 rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Ничего не найдено — сбросьте фильтры или измените запрос.
        </p>
      ) : (
        <div className="vf-scroll min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Дорожки студии">
          <ul className="space-y-1 pb-1">
            {visible.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isCurrent={track.id === currentId}
                playing={playing}
                isFavorite={favorites.has(track.id)}
                exploding={explodingTitle === track.title}
                onTogglePlay={onTogglePlay}
                onSelect={onSelect}
                onToggleFavorite={() => toggleFavorite(track.id)}
                onExplodeToStems={() => onExplodeToStems(track)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrackRow({
  track,
  isCurrent,
  playing,
  isFavorite,
  exploding,
  onTogglePlay,
  onSelect,
  onToggleFavorite,
  onExplodeToStems,
}: {
  track: AudioTrack;
  isCurrent: boolean;
  playing: boolean;
  isFavorite: boolean;
  exploding: boolean;
  onTogglePlay: (id: string) => void;
  onSelect: (id: string) => void;
  onToggleFavorite: () => void;
  onExplodeToStems: () => void;
}) {
  const isPlaying = isCurrent && playing;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition-colors hover:bg-accent/50",
        isCurrent && "border-border bg-accent/40",
      )}
    >
      <button
        type="button"
        onClick={() => onTogglePlay(track.id)}
        aria-label={isPlaying ? `Пауза — ${track.title}` : `Воспроизвести — ${track.title}`}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors",
          isCurrent
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-card text-foreground hover:border-primary/40 hover:text-primary",
        )}
      >
        {isPlaying ? (
          <Pause className="size-4" aria-hidden="true" />
        ) : (
          <Play className="size-4 translate-x-px" aria-hidden="true" />
        )}
      </button>

      <span className="hidden h-7 w-24 shrink-0 items-center gap-[2px] sm:flex" aria-hidden="true">
        {track.bars.map((h, i) => (
          <span
            key={i}
            className={cn(
              "w-[3px] rounded-full",
              isPlaying ? "animate-pulse bg-primary" : "bg-muted-foreground/30",
            )}
            style={{
              height: `${isPlaying ? h : Math.round(h * 0.7)}%`,
              animationDelay: `${(i % 6) * 90}ms`,
            }}
          />
        ))}
      </span>

      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(track.id)}>
        <span className="block truncate text-sm font-medium">{track.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {track.meta} · {track.mood.toLowerCase()} · {track.bpm} BPM{track.key !== "—" ? ` · ${track.key}` : ""}
        </span>
      </button>

      <span className="hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground md:inline-flex">
        <span
          className={cn("size-1.5 rounded-full", TRACK_TYPE_DOT[track.type])}
          aria-hidden="true"
        />
        {TRACK_TYPE_LABEL[track.type]}
      </span>

      <span className="hidden shrink-0 font-mono text-xs tabular-nums text-muted-foreground sm:inline">
        {formatTime(track.durationSec)}
      </span>

      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
          TRACK_STATUS_META[track.status].className,
        )}
      >
        {TRACK_STATUS_META[track.status].label}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-8 shrink-0",
          isFavorite ? "text-amber-500 hover:text-amber-500" : "text-muted-foreground",
        )}
        onClick={onToggleFavorite}
        aria-label={isFavorite ? `Убрать из избранного — ${track.title}` : `В избранное — ${track.title}`}
        aria-pressed={isFavorite}
      >
        <Star className={cn("size-4", isFavorite && "fill-amber-500")} aria-hidden="true" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="h-8 shrink-0 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        onClick={onExplodeToStems}
        disabled={exploding}
        aria-label={`Разложить в студии — ${track.title}`}
        title="Разложить на стемы (вокал/бит/бас/синт) во вкладке «Студия»"
      >
        {exploding ? (
          <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <Layers className="size-3.5" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">
          {exploding ? "Раскладываем…" : "Разложить в студии"}
        </span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden size-8 shrink-0 text-muted-foreground md:inline-flex"
        aria-label={`Меню дорожки «${track.title}»`}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </Button>
    </li>
  );
}
