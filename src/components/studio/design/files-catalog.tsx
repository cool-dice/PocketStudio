"use client";

/**
 * Каталог файлов дизайна («Файлы»): поиск, фильтр по типу со счётчиками,
 * сортировка по обновлению/названию. Клик открывает файл в нужном режиме.
 */

import { useMemo, useState } from "react";
import { ArrowDownUp, ChevronDown, FolderOpen, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  KIND_META,
  RECENT_FILES,
  type DesignFile,
  type DesignKind,
} from "./design-data";

type KindFilter = DesignKind | "all";
type SortMode = "updated" | "name";

const FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "raster", label: "Растр" },
  { id: "layout", label: "Макет" },
  { id: "preview", label: "Превью" },
];

export function FilesCatalog({
  currentId,
  onSelect,
}: {
  currentId: string;
  onSelect: (file: DesignFile) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [sort, setSort] = useState<SortMode>("updated");

  const counts = useMemo(() => {
    const base: Record<KindFilter, number> = {
      all: RECENT_FILES.length,
      raster: 0,
      layout: 0,
      preview: 0,
    };
    for (const f of RECENT_FILES) base[f.kind] += 1;
    return base;
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let items = RECENT_FILES.filter((f) => kind === "all" || f.kind === kind);
    if (q) {
      items = items.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.meta.toLowerCase().includes(q),
      );
    }
    const sorted = [...items];
    if (sort === "updated") {
      sorted.sort((a, b) => b.updatedTs - a.updatedTs);
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    }
    return sorted;
  }, [kind, query, sort]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FolderOpen className="size-4" aria-hidden="true" />
          Файлы
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="space-y-2.5 border-b p-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по файлам дизайна…"
              className="h-8 pl-8 text-xs"
              aria-label="Поиск файлов"
            />
          </div>
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Фильтр по типу"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setKind(f.id)}
                aria-pressed={kind === f.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                  kind === f.id
                    ? "border-primary/50 bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent/60",
                )}
              >
                {f.label}
                <span className="font-mono tabular-nums opacity-70">
                  {counts[f.id]}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSort((s) => (s === "updated" ? "name" : "updated"))}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 rounded"
            aria-label="Сменить сортировку"
          >
            <ArrowDownUp className="size-3" aria-hidden="true" />
            Сортировка:{" "}
            <span className="font-medium text-foreground">
              {sort === "updated" ? "по обновлению" : "по названию"}
            </span>
          </button>
        </div>

        <ul className="vf-scroll max-h-72 overflow-y-auto p-1.5" aria-label="Файлы дизайна">
          {list.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Ничего не найдено — попробуйте другой запрос
            </li>
          ) : (
            list.map((f) => {
              const Icon = KIND_META[f.kind].icon;
              const active = f.id === currentId;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(f);
                      setOpen(false);
                    }}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60",
                      active
                        ? "bg-primary/10"
                        : "hover:bg-accent/60",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        active
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "bg-muted/60 text-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-xs font-medium",
                          active && "text-primary",
                        )}
                      >
                        {f.name}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {f.meta}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {f.updated}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
