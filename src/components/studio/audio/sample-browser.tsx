"use client";

import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Disc3,
  Loader2,
  Pause,
  Play,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SelectableChip } from "./chip";
import {
  SAMPLES,
  SAMPLE_BPM_RANGES,
  SAMPLE_GENRES,
  SAMPLE_TYPES,
  makeWave,
  nextSampleId,
  sampleInRange,
  type SampleBpmRange,
  type SampleGenre,
  type SampleItem,
  type SampleType,
} from "./daw-data";

type SortKey = "name" | "date" | "bpm";
const GEN_GRADIENTS: Record<SampleGenre, string> = {
  "lo-fi": "linear-gradient(135deg,#34d399,#065f46)",
  synthwave: "linear-gradient(135deg,#fb7185,#9f1239)",
  оркестр: "linear-gradient(135deg,#fbbf24,#92400e)",
  эмбиент: "linear-gradient(135deg,#5eead4,#0f766e)",
};

/** Угадываем тип сэмпла по описанию (эвристика макета). */
function guessType(desc: string): SampleType {
  const d = desc.toLowerCase();
  if (d.includes("бас") || d.includes("саб")) return "бас";
  if (d.includes("барабан") || d.includes("бит") || d.includes("кик") || d.includes("снейр")) return "барабаны";
  if (d.includes("пад") || d.includes("синт") || d.includes("лид")) return "пад";
  if (d.includes("вокал") || d.includes("голос") || d.includes("хук")) return "вокал";
  return "FX";
}

/**
 * Библиотека сэмплов: поиск, фасетные фильтры со счётчиками,
 * сортировка, превью, добавление на дорожку, ИИ-генерация и загрузка своих.
 */
export function SampleBrowser({ onAddToTrack }: { onAddToTrack: (s: SampleItem) => void }) {
  const [samples, setSamples] = useState<SampleItem[]>(SAMPLES);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState<SampleGenre | "all">("all");
  const [type, setType] = useState<SampleType | "all">("all");
  const [bpmRange, setBpmRange] = useState<SampleBpmRange | "all">("all");
  const [sort, setSort] = useState<SortKey>("date");
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Панель генерации сэмпла
  const [genOpen, setGenOpen] = useState(false);
  const [genDesc, setGenDesc] = useState("тёмный бас с виниловым шумом");
  const [genGenre, setGenGenre] = useState<SampleGenre>("lo-fi");
  const [genBars, setGenBars] = useState("4");
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const byQuery = useMemo(
    () => samples.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase())),
    [samples, query],
  );

  const visible = useMemo(() => {
    const list = byQuery.filter(
      (s) =>
        (genre === "all" || s.genre === genre) &&
        (type === "all" || s.type === type) &&
        (bpmRange === "all" || sampleInRange(s.bpm, bpmRange)),
    );
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    if (sort === "date") sorted.sort((a, b) => b.createdAtMs - a.createdAtMs);
    if (sort === "bpm") sorted.sort((a, b) => a.bpm - b.bpm);
    return sorted;
  }, [byQuery, genre, type, bpmRange, sort]);

  const countOf = (predicate: (s: SampleItem) => boolean) => byQuery.filter(predicate).length;

  const handleGenerate = () => {
    if (generating) return;
    setGenerating(true);
    window.setTimeout(() => {
      const desc = genDesc.trim() || "новый сэмпл студии";
      setSamples((prev) => [
        {
          id: nextSampleId(),
          name: desc.length > 26 ? `${desc.slice(0, 25)}…` : desc,
          genre: genGenre,
          type: guessType(desc),
          bpm: 96 + Math.floor(Math.random() * 24),
          key: "Am",
          lengthBars: Number(genBars),
          gradient: GEN_GRADIENTS[genGenre],
          wave: makeWave(1000 + Math.floor(Math.random() * 2000)),
          createdAtMs: Date.now(),
          fresh: true,
        },
        ...prev.map((s) => ({ ...s, fresh: false })),
      ]);
      setGenerating(false);
      setGenOpen(false);
      toast.success("Сэмпл сгенерирован", { description: `«${desc.slice(0, 40)}» появился в библиотеке.` });
    }, 2000);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const clean = file.name.replace(/\.[^.]+$/, "");
    setSamples((prev) => [
      {
        id: nextSampleId(),
        name: clean,
        genre: "lo-fi",
        type: "пад",
        bpm: 120,
        key: "—",
        lengthBars: 4,
        gradient: "linear-gradient(135deg,#d6d3d1,#57534e)",
        wave: makeWave(clean.length * 97 + 13),
        createdAtMs: Date.now(),
        uploaded: true,
      },
      ...prev,
    ]);
    toast.success("Свой сэмпл загружен", { description: `«${clean}» — макет без реального аудио.` });
    e.target.value = "";
  };

  const handleAdd = (s: SampleItem) => {
    onAddToTrack(s);
    toast.success("Сэмпл добавлен на дорожку Сэмпл", { description: `«${s.name}» · ${s.bpm} BPM` });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2 sm:p-3">
      <div className="flex shrink-0 items-center gap-2">
        <Disc3 className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Библиотека сэмплов</h3>
        <span className="ml-auto text-[10px] font-medium tabular-nums text-muted-foreground">
          {visible.length} из {samples.length}
        </span>
      </div>

      <div className="relative shrink-0">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию…"
          className="h-8 pl-8 text-xs"
          aria-label="Поиск сэмплов"
        />
      </div>

      <FilterRow label="Жанр">
        <SelectableChip label="Все" selected={genre === "all"} onClick={() => setGenre("all")} count={byQuery.length} />
        {SAMPLE_GENRES.map((g) => (
          <SelectableChip
            key={g}
            label={g}
            selected={genre === g}
            onClick={() => setGenre(genre === g ? "all" : g)}
            count={countOf((s) => s.genre === g)}
          />
        ))}
      </FilterRow>
      <FilterRow label="Тип">
        <SelectableChip label="Все" selected={type === "all"} onClick={() => setType("all")} count={byQuery.length} />
        {SAMPLE_TYPES.map((t) => (
          <SelectableChip
            key={t}
            label={t}
            selected={type === t}
            onClick={() => setType(type === t ? "all" : t)}
            count={countOf((s) => s.type === t)}
          />
        ))}
      </FilterRow>
      <FilterRow label="BPM">
        <SelectableChip label="Все" selected={bpmRange === "all"} onClick={() => setBpmRange("all")} count={byQuery.length} />
        {SAMPLE_BPM_RANGES.map((r) => (
          <SelectableChip
            key={r}
            label={r}
            selected={bpmRange === r}
            onClick={() => setBpmRange(bpmRange === r ? "all" : r)}
            count={countOf((s) => sampleInRange(s.bpm, r))}
          />
        ))}
      </FilterRow>

      <div className="flex shrink-0 items-center gap-2">
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Сортировка сэмплов">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Сначала новые</SelectItem>
            <SelectItem value="name">По названию</SelectItem>
            <SelectItem value="bpm">По BPM</SelectItem>
          </SelectContent>
        </Select>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="sr-only"
          onChange={handleUpload}
          aria-label="Загрузить свой сэмпл"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 px-2.5"
          onClick={() => fileRef.current?.click()}
          title="Загрузить свой сэмпл (макет без реального аудио)"
        >
          <Upload className="size-3.5" aria-hidden="true" />
          Свой
          <span
            className="rounded-full border border-amber-500/50 bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold leading-none text-amber-700 dark:text-amber-400"
            aria-hidden="true"
          >
            В разработке
          </span>
        </Button>
      </div>

      {/* Сгенерировать сэмпл по описанию */}
      <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/5">
        <button
          type="button"
          onClick={() => setGenOpen((o) => !o)}
          aria-expanded={genOpen}
          className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs font-medium"
        >
          <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          Сгенерировать сэмпл по описанию
          <ChevronDown
            className={cn("ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform", genOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {genOpen ? (
          <div className="space-y-2 border-t px-2.5 py-2">
            <Textarea
              rows={2}
              value={genDesc}
              onChange={(e) => setGenDesc(e.target.value)}
              placeholder="Например: тёмный бас с виниловым шумом"
              className="resize-none text-xs"
              aria-label="Описание сэмпла"
            />
            <div className="flex gap-2">
              <Select value={genGenre} onValueChange={(v) => setGenGenre(v as SampleGenre)}>
                <SelectTrigger className="h-8 flex-1 text-xs" aria-label="Жанр сэмпла">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLE_GENRES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={genBars} onValueChange={setGenBars}>
                <SelectTrigger className="h-8 w-28 text-xs" aria-label="Длительность сэмпла">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 такта</SelectItem>
                  <SelectItem value="4">4 такта</SelectItem>
                  <SelectItem value="8">8 тактов</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-8 w-full" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Генерация…
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Сгенерировать
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Список сэмплов */}
      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          Ничего не найдено — измените фильтры или запрос.
        </p>
      ) : (
        <ul
          className="vf-scroll min-h-0 flex-1 max-h-[26rem] space-y-1.5 overflow-y-auto pr-1 lg:max-h-none"
          aria-label="Сэмплы"
        >
          {visible.map((s) => (
            <SampleCard
              key={s.id}
              sample={s}
              previewing={previewId === s.id}
              onTogglePreview={() => setPreviewId(previewId === s.id ? null : s.id)}
              onAdd={() => handleAdd(s)}
            />
          ))}
        </ul>
      )}
      <p className="shrink-0 text-center text-[10px] text-muted-foreground">
        Генерация и превью сэмплов — визуальный макет
      </p>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-start gap-2">
      <span className="pt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">{children}</div>
    </div>
  );
}

function SampleCard({
  sample,
  previewing,
  onTogglePreview,
  onAdd,
}: {
  sample: SampleItem;
  previewing: boolean;
  onTogglePreview: () => void;
  onAdd: () => void;
}) {
  const n = sample.wave.length;
  const w = 100 / n;
  return (
    <li className="rounded-lg border bg-background p-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onTogglePreview}
          aria-label={previewing ? `Остановить превью — ${sample.name}` : `Послушать превью — ${sample.name}`}
          className="relative size-10 shrink-0 overflow-hidden rounded-md shadow-inner"
          style={{ background: sample.gradient }}
        >
          <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="absolute inset-0 h-full w-full px-1 py-1.5" aria-hidden="true">
            {sample.wave.map((h, i) => (
              <rect
                key={i}
                x={i * w}
                y={20 - (h * 0.36) / 2}
                width={Math.max(1, w - 1)}
                height={Math.max(2, h * 0.36)}
                rx={0.5}
                fill="#ffffff"
                fillOpacity={previewing ? 0.95 : 0.6}
                className={previewing ? "animate-pulse" : undefined}
              />
            ))}
          </svg>
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/40">
            {previewing ? (
              <Pause className="size-4 text-white" aria-hidden="true" />
            ) : (
              <Play className="size-4 translate-x-px text-white" aria-hidden="true" />
            )}
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium" title={sample.name}>
            {sample.name}
            {sample.fresh ? (
              <span className="ml-1.5 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-px text-[9px] font-semibold text-primary">
                новое
              </span>
            ) : null}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {sample.genre} · {sample.type} · {sample.lengthBars} такт{sample.lengthBars === 1 ? "" : "ов"}
            {sample.uploaded ? " · свой" : ""}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground">
          {sample.bpm} BPM
        </span>
        <span className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          {sample.key}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto h-6 px-2 text-[11px]"
          onClick={onAdd}
        >
          <Plus className="size-3" aria-hidden="true" />
          На дорожку
        </Button>
      </div>
    </li>
  );
}
