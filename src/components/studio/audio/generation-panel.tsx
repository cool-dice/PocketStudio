"use client";

import { useState } from "react";
import { CheckCircle2, Mic, Music, Podcast, Waves } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SelectableChip } from "./chip";
import {
  AMBIENCES,
  MUSIC_DURATIONS,
  MUSIC_GENRES,
  MUSIC_MOODS,
  PODCAST_LENGTHS,
  VOICES,
  formatSpeed,
} from "./tracks-data";

/**
 * Панель генерации аудио: четыре режима —
 * озвучка, музыка, подкаст и шумы. Только локальный state.
 */
export function GenerationPanel() {
  // Озвучка
  const [voiceId, setVoiceId] = useState<string>(VOICES[0].id);
  const [script, setScript] = useState("");
  const [speechSpeed, setSpeechSpeed] = useState(1);
  // Музыка
  const [genre, setGenre] = useState(MUSIC_GENRES[0]!);
  const [mood, setMood] = useState(MUSIC_MOODS[0]!);
  const [duration, setDuration] = useState(MUSIC_DURATIONS[1]!);
  // Подкаст
  const [topic, setTopic] = useState("");
  const [duo, setDuo] = useState<"solo" | "duo">("duo");
  const [length, setLength] = useState(PODCAST_LENGTHS[1]!);
  // Шумы
  const [ambience, setAmbience] = useState(AMBIENCES[0]!);
  const [intensity, setIntensity] = useState(55);

  return (
    <section
      aria-label="Панель генерации аудио"
      className="shrink-0 rounded-xl border bg-card p-4 shadow-sm"
    >
      <Tabs defaultValue="voice">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="voice">
            <Mic className="size-4" aria-hidden="true" />
            Озвучка
          </TabsTrigger>
          <TabsTrigger value="music">
            <Music className="size-4" aria-hidden="true" />
            Музыка
          </TabsTrigger>
          <TabsTrigger value="podcast">
            <Podcast className="size-4" aria-hidden="true" />
            Подкаст
          </TabsTrigger>
          <TabsTrigger value="noise">
            <Waves className="size-4" aria-hidden="true" />
            Шумы
          </TabsTrigger>
        </TabsList>

        {/* ── Озвучка ── */}
        <TabsContent value="voice" className="mt-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Голос студии</p>
            <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
              {VOICES.map((v) => {
                const selected = voiceId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVoiceId(v.id)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:bg-accent/50",
                      selected ? "border-transparent ring-2 ring-primary" : "border-border",
                    )}
                  >
                    <span
                      className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-inner"
                      style={{ background: v.gradient }}
                      aria-hidden="true"
                    >
                      {v.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{v.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {v.role} · {v.note}
                      </span>
                    </span>
                    {selected ? (
                      <CheckCircle2 className="ml-auto size-4 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="voice-script" className="text-sm font-medium">
              Текст
            </label>
            <Textarea
              id="voice-script"
              rows={3}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Вставьте текст главы, поста или сценария…"
              className="mt-2 resize-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex min-w-52 flex-1 items-center gap-3">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">Скорость</span>
              <Slider
                min={0.75}
                max={1.5}
                step={0.25}
                value={[speechSpeed]}
                onValueChange={([v]) => setSpeechSpeed(v)}
                className="flex-1"
                aria-label="Скорость речи"
              />
              <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                {formatSpeed(speechSpeed)}
              </span>
            </div>
            <Button className="shrink-0">
              <Mic className="size-4" aria-hidden="true" />
              Озвучить
            </Button>
          </div>
        </TabsContent>

        {/* ── Музыка ── */}
        <TabsContent value="music" className="mt-4 space-y-4">
          <ChipGroup label="Жанр" items={MUSIC_GENRES} selected={genre} onSelect={setGenre} />
          <ChipGroup label="Настроение" items={MUSIC_MOODS} selected={mood} onSelect={setMood} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <ChipGroup
              label="Длительность"
              items={MUSIC_DURATIONS}
              selected={duration}
              onSelect={setDuration}
            />
            <Button className="shrink-0">
              <Music className="size-4" aria-hidden="true" />
              Создать трек
            </Button>
          </div>
        </TabsContent>

        {/* ── Подкаст ── */}
        <TabsContent value="podcast" className="mt-4 space-y-4">
          <div>
            <label htmlFor="podcast-topic" className="text-sm font-medium">
              Тема выпуска
            </label>
            <Input
              id="podcast-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Например: откуда писатели берут сюжеты"
              className="mt-2"
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs font-medium text-muted-foreground">Ведущие</span>
            <div
              className="inline-flex items-center rounded-lg bg-muted p-0.5"
              role="group"
              aria-label="Формат ведущих"
            >
              {(
                [
                  { value: "solo", label: "Один ведущий" },
                  { value: "duo", label: "Диалог" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDuo(opt.value)}
                  aria-current={duo === opt.value ? "true" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    duo === opt.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <ChipGroup
              label="Хронометраж"
              items={PODCAST_LENGTHS}
              selected={length}
              onSelect={setLength}
            />
            <Button className="shrink-0">
              <Podcast className="size-4" aria-hidden="true" />
              Сгенерировать выпуск
            </Button>
          </div>
        </TabsContent>

        {/* ── Шумы ── */}
        <TabsContent value="noise" className="mt-4 space-y-4">
          <ChipGroup label="Атмосфера" items={AMBIENCES} selected={ambience} onSelect={setAmbience} />
          <div className="flex min-w-52 max-w-xs items-center gap-3">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Интенсивность</span>
            <Slider
              min={10}
              max={100}
              step={5}
              value={[intensity]}
              onValueChange={([v]) => setIntensity(v)}
              className="flex-1"
              aria-label="Интенсивность шума"
            />
            <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
              {intensity}%
            </span>
          </div>
          <div className="flex justify-end border-t pt-4">
            <Button>
              <Waves className="size-4" aria-hidden="true" />
              Смешать
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

/** Строка чипов с подписью слева — переиспользуется всеми режимами. */
function ChipGroup({
  label,
  items,
  selected,
  onSelect,
}: {
  label: string;
  items: readonly string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <SelectableChip
            key={item}
            label={item}
            selected={selected === item}
            onClick={() => onSelect(item)}
          />
        ))}
      </div>
    </div>
  );
}
