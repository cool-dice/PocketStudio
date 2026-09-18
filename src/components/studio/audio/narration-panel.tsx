"use client";

/**
 * NarrationPanel — живая панель озвучки (Фаза A).
 *
 * Текст → выбор голоса студии (7 голосов) → скорость 0.5–2.0 →
 * api.aiTts({projectId, text, title, voice, speed}) — реальный TTS
 * (~3 секунды), готовый WAV-файл прилетает артефактом и появляется
 * в библиотеке озвучек ниже (onCreated дёргает refresh библиотеки).
 */

import { useState } from "react";
import { CheckCircle2, Loader2, Mic, Volume2 } from "lucide-react";
import { toast } from "sonner";

import type { ArtifactDto } from "@/lib/workspace-types";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  NARRATION_MAX_CHARS,
  NARRATION_VOICES,
  type NarrationVoiceId,
} from "./narration-data";
import { formatSpeed } from "./tracks-data";

export function NarrationPanel({
  workspaceId,
  onCreated,
}: {
  workspaceId: string;
  /** Артефакт создан — библиотека перезагружается. */
  onCreated: (artifact: ArtifactDto) => void;
}) {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [voice, setVoice] = useState<NarrationVoiceId>("tongtong");
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);

  const trimmed = text.trim();
  const canGenerate = !busy && trimmed.length >= 3 && trimmed.length <= NARRATION_MAX_CHARS;

  async function generate() {
    if (!canGenerate) return;
    setBusy(true);
    try {
      const artifact = await api.aiTts({
        projectId: workspaceId,
        text: trimmed,
        title: title.trim() || undefined,
        voice,
        speed,
      });
      toast.success("Озвучка готова", {
        description: `«${artifact.title}» — трек появился в библиотеке ниже.`,
      });
      onCreated(artifact);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Студия не смогла озвучить текст — попробуйте ещё раз";
      toast.error("Озвучка не удалась", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Панель озвучки"
      className="shrink-0 rounded-xl border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <Volume2 className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold leading-tight">Озвучка текста</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Студия прочитает текст выбранным голосом — трек появится в библиотеке ниже.
          </p>
        </div>
      </div>

      {/* Текст + название */}
      <div className="mt-4">
        <label htmlFor="narration-text" className="flex items-baseline justify-between gap-2 text-sm font-medium">
          Текст
          <span
            className={cn(
              "text-xs tabular-nums",
              trimmed.length > NARRATION_MAX_CHARS ? "text-destructive" : "text-muted-foreground",
            )}
            aria-live="polite"
          >
            {trimmed.length} / {NARRATION_MAX_CHARS}
          </span>
        </label>
        <Textarea
          id="narration-text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Вставьте фрагмент главы, поста или сценария — например: «Шторм пришёл с запада, как возвращающийся должник…»"
          className="mt-2 resize-none"
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название (необязательно) — например «Интро главы 9»"
          className="mt-2"
          maxLength={160}
          aria-label="Название озвучки"
        />
      </div>

      {/* Голоса студии */}
      <div className="mt-4">
        <p className="text-xs font-medium text-muted-foreground">Голос студии</p>
        <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
          {NARRATION_VOICES.map((v) => {
            const selected = voice === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoice(v.id)}
                aria-pressed={selected}
                disabled={busy}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:bg-accent/50 disabled:opacity-60",
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
                  <span className="block truncate text-xs text-muted-foreground">{v.note}</span>
                </span>
                {selected ? (
                  <CheckCircle2 className="ml-auto size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Скорость + запуск */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-4">
        <div className="flex min-w-52 flex-1 items-center gap-3">
          <span className="shrink-0 text-xs font-medium text-muted-foreground">Скорость</span>
          <Slider
            min={0.5}
            max={2}
            step={0.25}
            value={[speed]}
            onValueChange={([v]) => setSpeed(v)}
            className="flex-1"
            aria-label="Скорость речи"
            disabled={busy}
          />
          <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
            {formatSpeed(speed)}
          </span>
        </div>
        <Button
          className="shrink-0"
          onClick={generate}
          disabled={!canGenerate}
          aria-live="polite"
        >
          {busy ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Студия читает вслух…
            </>
          ) : (
            <>
              <Mic className="size-4" aria-hidden="true" />
              Озвучить
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
