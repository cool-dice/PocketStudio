"use client";

/**
 * SceneCard — карточка-строка сцены раскадровки (Task 5-b).
 *
 * Слева мини-превью кадра (или плитка-заглушка с номером), справа:
 * заголовок + бейджи готовности («кадр ✓» / «озвучка ✓»), текст сцены
 * с дебаунс-автосейвом (800 мс, таймер в useRef, флуш при размонтировании),
 * строка генерации кадра (свой промпт или текст сцены) и озвучки (голос TTS).
 */

import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  ImagePlus,
  Loader2,
  Mic,
  Play,
  RefreshCw,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DocumentSectionDto } from "@/lib/workspace-types";
import { SCENE_AUTOSAVE_MS, VOICES, type VideoScene } from "./video-data";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface SceneCardProps {
  scene: VideoScene;
  index: number;
  /** Идёт генерация кадра этой сцены (~30–45 сек). */
  imageBusy: boolean;
  /** Идёт озвучка этой сцены. */
  voiceBusy: boolean;
  /** Сохранить текст сцены (дебаунс уже отработал). true = успех. */
  onSaveContent: (id: string, content: string) => Promise<boolean>;
  /** Сгенерировать кадр: effectivePrompt = свой промпт или текст сцены. */
  onGenerateFrame: (sectionId: string, effectivePrompt: string) => void;
  /** Озвучить текст сцены выбранным голосом. */
  onGenerateVoice: (sectionId: string, text: string, voice: string) => void;
  /** Запустить плеер сборки с этой сцены. */
  onPlayFrom: (index: number) => void;
}

export function SceneCard({
  scene,
  index,
  imageBusy,
  voiceBusy,
  onSaveContent,
  onGenerateFrame,
  onGenerateVoice,
  onPlayFrom,
}: SceneCardProps) {
  const section = scene.section;
  const [draft, setDraft] = useState(section.content);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [prompt, setPrompt] = useState("");
  const [voice, setVoice] = useState("alloy");

  /* Карточка переиспользуется для другой секции — сброс локального драфта. */
  const [prevId, setPrevId] = useState(section.id);
  if (prevId !== section.id) {
    setPrevId(section.id);
    setDraft(section.content);
    setSaveState("idle");
    setPrompt("");
  }

  const timerRef = useRef<number | null>(null);
  const pendingRef = useRef<{ id: string; content: string } | null>(null);
  const saveRef = useRef(onSaveContent);
  const sectionRef = useRef<DocumentSectionDto>(section);
  useEffect(() => {
    saveRef.current = onSaveContent;
  }, [onSaveContent]);
  useEffect(() => {
    sectionRef.current = section;
  }, [section]);

  const runSave = () => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    setSaveState("saving");
    saveRef
      .current(pending.id, pending.content)
      .then((ok) => setSaveState(ok ? "saved" : "error"))
      .catch(() => setSaveState("error"));
  };

  const changeContent = (value: string) => {
    setDraft(value);
    pendingRef.current = { id: sectionRef.current.id, content: value };
    setSaveState("dirty");
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      runSave();
    }, SCENE_AUTOSAVE_MS);
  };

  /* Размонтирование: снять таймер и флушнуть несохранённый текст. */
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = null;
        void saveRef.current(pending.id, pending.content);
      }
    },
    [],
  );

  const words = wordsLabel(countWords(draft));
  const inputId = `scene-text-${section.id}`;

  return (
    <article
      aria-label={`Сцена ${index + 1}: ${section.title}`}
      className="rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Мини-превью кадра */}
        <div className="w-full shrink-0 sm:w-44 lg:w-52">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-stone-950">
            {scene.imageUrl ? (
              <img
                src={scene.imageUrl}
                alt={`Кадр сцены «${section.title}»`}
                loading="lazy"
                className="absolute inset-0 size-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-stone-900 to-stone-800 text-stone-500">
                {imageBusy ? (
                  <>
                    <Loader2
                      className="size-6 animate-spin text-primary"
                      aria-hidden="true"
                    />
                    <span className="text-[10px] uppercase tracking-widest">
                      рисуем кадр
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-lg font-semibold text-stone-300">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest">
                      без кадра
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Контент сцены */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h3 className="min-w-0 text-sm font-semibold leading-tight">
              {section.title}
            </h3>
            {scene.imageUrl ? <ReadyBadge icon={ImagePlus} label="кадр" /> : null}
            {scene.voiceUrl ? (
              <ReadyBadge icon={Volume2} label="озвучка" />
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 shrink-0 gap-1.5 px-2.5 text-xs"
              onClick={() => onPlayFrom(index)}
              aria-label={`Смотреть фильм с сцены ${index + 1}`}
            >
              <Play className="size-3.5" aria-hidden="true" />
              С этой сцены
            </Button>
          </header>

          <div>
            <label htmlFor={inputId} className="sr-only">
              Текст сцены «{section.title}» — закадровый текст и описание кадра
            </label>
            <Textarea
              id={inputId}
              rows={4}
              value={draft}
              onChange={(e) => changeContent(e.target.value)}
              placeholder="Что происходит в кадре и что говорит диктор…"
              className="min-h-24 resize-y text-sm leading-relaxed"
            />
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {saveState === "saving" ? (
                <>
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  Сохранение…
                </>
              ) : saveState === "saved" ? (
                <>
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                  Сохранено
                </>
              ) : saveState === "error" ? (
                <>
                  <RefreshCw className="size-3" aria-hidden="true" />
                  Не сохранилось — поправьте текст
                </>
              ) : (
                <>
                  <Clock3 className="size-3" aria-hidden="true" />
                  автосохранение
                </>
              )}
              <span className="ml-auto shrink-0 tabular-nums" aria-live="polite">
                {words}
              </span>
            </p>
          </div>

          {/* Генерация кадра и озвучки */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Промпт кадра — пусто = текст сцены"
                aria-label={`Промпт кадра для сцены «${section.title}»`}
                className="h-9 flex-1 text-sm"
                maxLength={400}
              />
              <Button
                size="sm"
                className="h-9 shrink-0 gap-1.5"
                disabled={imageBusy}
                onClick={() =>
                  onGenerateFrame(section.id, prompt.trim() || draft.trim())
                }
              >
                {imageBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Рисуем…
                  </>
                ) : (
                  <>
                    <ImagePlus className="size-4" aria-hidden="true" />
                    Кадр
                  </>
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <label className="relative flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-background pl-2.5 pr-6 text-sm shadow-xs">
                <Mic
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  aria-label={`Голос озвучки сцены «${section.title}»`}
                  className="h-full w-full appearance-none truncate bg-transparent text-sm outline-none"
                >
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              </label>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 shrink-0 gap-1.5"
                disabled={voiceBusy}
                onClick={() => onGenerateVoice(section.id, draft.trim(), voice)}
              >
                {voiceBusy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Читаем…
                  </>
                ) : (
                  <>
                    <Volume2 className="size-4" aria-hidden="true" />
                    Озвучить
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ReadyBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5",
        "border-emerald-500/40 bg-emerald-500/10 text-[11px] font-medium text-emerald-700 dark:text-emerald-400",
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
      <CheckCircle2 className="size-3" aria-hidden="true" />
    </span>
  );
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function wordsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  let word = "слов";
  if (mod10 === 1 && mod100 !== 11) word = "слово";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    word = "слова";
  }
  return `${count} ${word}`;
}
