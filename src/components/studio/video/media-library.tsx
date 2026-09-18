"use client";

/**
 * МЕДИАТЕКА — каталогизация: поиск, фильтр по типам со счётчиками,
 * теги (Сцена 01–08 / Озвучка / Музыка), сортировка. Клик выбирает
 * источник, «+» добавляет клип на таймлайн (мок).
 */

import { useMemo, useState } from "react";

import { Check, Plus, Search, Wand2 } from "lucide-react";

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

import {
  formatDateRu,
  formatDur,
  MEDIA_ITEMS,
  MEDIA_TAGS,
  MEDIA_TYPE_FILTERS,
  type ClipKind,
  type MediaItem,
} from "./nle-data";

type SortId = "name" | "duration" | "date";

const SORT_LABEL: Record<SortId, string> = {
  name: "По названию",
  duration: "По длительности",
  date: "По дате",
};

function chipClass(active: boolean): string {
  return cn(
    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
  );
}

export function MediaLibrary({
  onAdd,
  onGenerate,
}: {
  onAdd: (item: MediaItem) => void;
  onGenerate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ClipKind | "all">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortId>("name");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map = new Map<ClipKind | "all", number>([["all", MEDIA_ITEMS.length]]);
    for (const item of MEDIA_ITEMS)
      map.set(item.type, (map.get(item.type) ?? 0) + 1);
    return map;
  }, []);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = MEDIA_ITEMS.filter((item) => {
      if (type !== "all" && item.type !== type) return false;
      if (tag && item.tag !== tag) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
    const sorted = [...filtered];
    if (sort === "name")
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    else if (sort === "duration") sorted.sort((a, b) => b.duration - a.duration);
    else sorted.sort((a, b) => b.date.localeCompare(a.date));
    return sorted;
  }, [query, type, tag, sort]);

  return (
    <section
      aria-label="Медиатека"
      className="flex min-w-0 flex-col gap-2.5 rounded-xl border bg-card p-3"
    >
      <header className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Медиатека
        </h3>
        <span className="rounded-full border bg-muted/60 px-2 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {items.length}/{MEDIA_ITEMS.length}
        </span>
      </header>

      {/* Сгенерировать сцену */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 min-w-0 flex-1 text-[11px]"
          onClick={onGenerate}
        >
          <Wand2 aria-hidden="true" />
          Сгенерировать сцену
        </Button>
        <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
          В разработке
        </span>
      </div>

      {/* Поиск */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию…"
          aria-label="Поиск в медиатеке"
          className="h-8 pl-8 text-xs"
        />
      </div>

      {/* Типы со счётчиками */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр по типу">
        {MEDIA_TYPE_FILTERS.map((f) => {
          const active = type === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setType(f.id)}
              aria-pressed={active}
              className={chipClass(active)}
            >
              {f.label}
              <span className="ml-1 font-mono tabular-nums opacity-70">
                {counts.get(f.id) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Теги-сцены */}
      <div
        className="vf-scroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        role="group"
        aria-label="Теги сцен"
      >
        {MEDIA_TAGS.map((t) => {
          const active = tag === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTag(active ? null : t)}
              aria-pressed={active}
              className={cn(chipClass(active), "text-[10px]")}
            >
              {active ? <Check className="mr-1 inline size-3" aria-hidden="true" /> : null}
              {t}
            </button>
          );
        })}
      </div>

      {/* Сортировка */}
      <Select value={sort} onValueChange={(v) => setSort(v as SortId)}>
        <SelectTrigger
          size="sm"
          aria-label="Сортировка медиатеки"
          className="h-8 w-full text-xs"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABEL) as SortId[]).map((id) => (
            <SelectItem key={id} value={id} className="text-xs">
              {SORT_LABEL[id]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Список */}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
          Ничего не найдено — измените фильтры
        </p>
      ) : (
        <ul className="vf-scroll max-h-[26rem] space-y-1.5 overflow-y-auto pr-1 lg:max-h-[34rem]">
          {items.map((item) => {
            const selected = selectedId === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-1.5 transition-colors",
                    selected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border/70 hover:border-primary/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(selected ? null : item.id)}
                    aria-pressed={selected}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md p-0.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="relative block h-10 w-14 shrink-0 overflow-hidden rounded-md">
                      <span
                        aria-hidden="true"
                        className={cn("absolute inset-0 bg-gradient-to-br", item.gradient)}
                      />
                      <Icon
                        className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-white/40"
                        aria-hidden="true"
                      />
                      <span
                        className="absolute bottom-0.5 right-0.5 rounded bg-black/55 px-1 font-mono text-[9px] tabular-nums text-white/90 backdrop-blur"
                        aria-hidden="true"
                      >
                        {formatDur(item.duration)}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {item.name}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {item.meta} · {formatDateRu(item.date)}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant={selected ? "default" : "ghost"}
                    size="sm"
                    className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                    onClick={() => onAdd(item)}
                    aria-label={`Добавить «${item.name}» на таймлайн`}
                  >
                    <Plus aria-hidden="true" />
                    {selected ? "На таймлайн" : null}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
