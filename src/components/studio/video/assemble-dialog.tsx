"use client";

/**
 * AssembleDialog (7-b) — «Сборка фильма»: настоящий рендер раскадровки в
 * WebM через film-compiler (canvas + MediaRecorder). Настройки разрешения
 * и титров, живой прогресс (кадры → сцены), отмена, загрузка результата
 * в библиотеку воркспейса (stage «Монтаж») и предпросмотр <video>.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Clapperboard,
  Clock3,
  Download,
  Film,
  HardDrive,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ArtifactDto } from "@/lib/workspace-types";
import {
  compileFilm,
  filmRenderSupported,
  type CompilePhase,
  type FilmSceneSource,
} from "./film-compiler";

type Resolution = "hd" | "light";
type Step = "idle" | "load" | "render" | "upload" | "done" | "error";

interface AssembleResult {
  url: string;
  durationSec: number;
  sizeBytes: number;
}

export interface AssembleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** Название сценария — для имени файла и заголовка артефакта. */
  scriptTitle: string;
  scenes: FilmSceneSource[];
  /** Фильм загружен в библиотеку воркспейса. */
  onAssembled: (artifact: ArtifactDto) => void;
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/** «Сценарий: Хроники» → «scenariy-hroniki» (имя файла для скачивания). */
function slugify(title: string): string {
  const latin = title
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("");
  const slug = latin.replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-");
  return slug.replace(/^-|-$/g, "") || "film";
}

function formatClock(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function AssembleDialog({
  open,
  onOpenChange,
  projectId,
  scriptTitle,
  scenes,
  onAssembled,
}: AssembleDialogProps) {
  const supported = useMemo(() => filmRenderSupported(), []);
  const [resolution, setResolution] = useState<Resolution>("hd");
  const [showTitles, setShowTitles] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [phase, setPhase] = useState<CompilePhase>("load");
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssembleResult | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  const withFrame = scenes.filter((s) => s.imageUrl).length;
  const withVoice = scenes.filter((s) => s.audioUrl).length;
  const busy = step === "load" || step === "render" || step === "upload";
  const total = scenes.length;

  /* objectURL: единая точка создания/освобождения. */
  const setFilmUrl = useCallback((url: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = url;
  }, []);
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  /* Открытие диалога — чистый лист (настройки сохраняются между открытиями). */
  useEffect(() => {
    if (!open) return;
    setFilmUrl(null);
    setResult(null);
    setStep("idle");
    setError(null);
    setDone(0);
    setElapsedSec(0);
  }, [open, setFilmUrl]);

  /* Закрытие во время рендера = отмена сборки. */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (busy && !next) abortRef.current?.abort();
      onOpenChange(next);
    },
    [busy, onOpenChange],
  );

  /* Таймер прошедшего времени, пока идёт сборка. */
  useEffect(() => {
    if (!busy) return undefined;
    const startedAt = Date.now() - elapsedSec * 1000;
    const timer = window.setInterval(() => {
      setElapsedSec((Date.now() - startedAt) / 1000);
    }, 500);
    return () => window.clearInterval(timer);
  }, [busy]);

  const startCompile = useCallback(async () => {
    if (busy || scenes.length === 0) return;
    if (withFrame === 0) {
      setError("Сначала сгенерируйте кадр хотя бы для одной сцены — без картинок сборка не запускается.");
      setStep("error");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setFilmUrl(null);
    setResult(null);
    setError(null);
    setDone(0);
    setPhase("load");
    setStep("load");
    setElapsedSec(0);
    const { width, height } =
      resolution === "hd" ? { width: 1280, height: 720 } : { width: 854, height: 480 };
    try {
      const compiled = await compileFilm(scenes, {
        width,
        height,
        showTitles,
        signal: controller.signal,
        onProgress: (nextPhase, nextDone) => {
          setPhase(nextPhase);
          setDone(nextDone);
        },
      });
      setStep("upload");
      const artifact = await api.uploadArtifact(projectId, {
        blob: compiled.blob,
        type: "video",
        title: `Фильм: ${scriptTitle}`,
        description: "Собран в браузере из сцен раскадровки",
        stage: "Монтаж",
        meta: {
          scenes: scenes.length,
          durationSec: Math.round(compiled.durationSec * 10) / 10,
          width,
          height,
          titles: showTitles,
          source: "storyboard",
        },
      });
      const url = URL.createObjectURL(compiled.blob);
      setFilmUrl(url);
      setResult({
        url,
        durationSec: compiled.durationSec,
        sizeBytes: compiled.blob.size,
      });
      setStep("done");
      onAssembled(artifact);
    } catch (err) {
      if (controller.signal.aborted) {
        setStep("idle");
        toast.info("Сборка отменена");
      } else {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Не удалось собрать фильм";
        setError(message);
        setStep("error");
        toast.error("Фильм не собрался", { description: message });
      }
    } finally {
      abortRef.current = null;
    }
  }, [busy, scenes, withFrame, resolution, showTitles, projectId, scriptTitle, onAssembled, setFilmUrl]);

  const progressValue =
    step === "upload"
      ? 100
      : total > 0
        ? Math.min(
            100,
            step === "render" ? ((done + 1) / total) * 100 : (done / total) * 100,
          )
        : 0;
  const caption =
    step === "load"
      ? `Готовим кадры… ${done}/${total}`
      : step === "render"
        ? `Рендерим… сцена ${Math.min(done + 1, total)} из ${total} · ${formatClock(elapsedSec)}`
        : step === "upload"
          ? "Сохраняем фильм в библиотеку…"
          : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90dvh] overflow-y-auto sm:max-w-md",
          step === "done" && "sm:max-w-xl",
        )}
      >
        <DialogHeader className="pr-10">
          <DialogTitle className="text-base">Сборка фильма</DialogTitle>
          <DialogDescription>
            {scriptTitle} · {total}{" "}
            {total === 1 ? "сцена" : total < 5 ? "сцены" : "сцен"}
          </DialogDescription>
        </DialogHeader>

        {step === "done" && result ? (
          /* ── Результат ── */
          <div className="flex flex-col gap-3">
            <video
              controls
              src={result.url}
              aria-label="Предпросмотр собранного фильма"
              className="aspect-video w-full rounded-lg border bg-black"
            />
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">
                <Clock3 aria-hidden="true" />
                {formatClock(result.durationSec)}
              </Badge>
              <Badge variant="secondary">
                <HardDrive aria-hidden="true" />
                {(result.sizeBytes / 1_048_576).toFixed(1)} МБ
              </Badge>
              <Badge variant="secondary">
                <Film aria-hidden="true" />
                {total} сцен
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Фильм в библиотеке воркспейса — вкладка «Обзор» покажет его в
              стадии «Монтаж».
            </p>
          </div>
        ) : busy ? (
          /* ── Прогресс ── */
          <div className="flex flex-col gap-3">
            <Progress value={progressValue} aria-label="Прогресс сборки" />
            <p className="text-sm font-medium" aria-live="polite">
              {caption}
            </p>
            <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              Не закрывайте и не сворачивайте вкладку — сборка идёт в реальном
              времени
            </p>
          </div>
        ) : (
          /* ── Настройки / ошибка ── */
          <div className="flex flex-col gap-3">
            {step === "error" && error ? (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {withFrame === 0 ? (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Нет кадров — сгенерируйте изображение сцены, иначе фильм не соберём.
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="film-resolution">Разрешение</Label>
              <Select
                value={resolution}
                onValueChange={(v: string) => setResolution(v as Resolution)}
              >
                <SelectTrigger id="film-resolution" size="sm" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hd">1280×720 · HD</SelectItem>
                  <SelectItem value="light">854×480 · Лёгкое</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Label
              htmlFor="film-titles"
              className="justify-between rounded-lg border p-3 font-normal"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Титры сцен</span>
                <span className="text-xs font-normal text-muted-foreground">
                  Название и первые строки в начале каждой сцены
                </span>
              </span>
              <Checkbox
                id="film-titles"
                checked={showTitles}
                onCheckedChange={(v) => setShowTitles(Boolean(v))}
              />
            </Label>
            <p className="text-xs text-muted-foreground">
              С кадром: {withFrame} · с озвучкой: {withVoice} · рендер идёт
              в реальном времени ({formatClock(estimateDuration(scenes))}{" "}
              примерно)
            </p>
            {!supported ? (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                Браузер не поддерживает запись видео — попробуйте Chrome или
                Firefox.
              </p>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "done" && result ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Закрыть
              </Button>
              <Button asChild>
                <a href={result.url} download={`${slugify(scriptTitle)}.webm`}>
                  <Download className="size-4" aria-hidden="true" />
                  Скачать WebM
                </a>
              </Button>
            </>
          ) : busy ? (
            <Button
              variant="outline"
              onClick={() => abortRef.current?.abort()}
            >
              <X className="size-4" aria-hidden="true" />
              Отменить
            </Button>
          ) : step === "error" ? (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Закрыть
              </Button>
              <Button onClick={() => void startCompile()}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Повторить
              </Button>
            </>
          ) : (
            <Button
              onClick={() => void startCompile()}
              disabled={!supported || scenes.length === 0 || withFrame === 0}
              className={cn(
                "gap-1.5",
                supported &&
                  "border-emerald-600/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400",
              )}
            >
              <Clapperboard className="size-4" aria-hidden="true" />
              {supported ? "Собрать фильм" : "Браузер не поддерживает запись видео"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Грубая оценка длительности (3.5–18 с чтения текста на сцену + хвост). */
function estimateDuration(scenes: FilmSceneSource[]): number {
  let total = 0.6;
  for (const scene of scenes) {
    const readSec = Math.min(18, Math.max(3.5, 3.5 + scene.text.length * 0.055));
    total += readSec + (scene.audioUrl ? 0.4 : 0.2);
  }
  return total;
}
