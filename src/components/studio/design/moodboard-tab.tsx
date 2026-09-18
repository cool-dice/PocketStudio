"use client";

/**
 * MoodboardTab (Фаза A) — вкладка «Мудборд» дизайн-модуля на живых
 * артефактах воркспейса: все image/portrait, у кого stage "design" —
 * «в мудборде» (emerald-рамка + бейдж). Панель генерации кадра
 * (30–45 сек, плашка прогресса + pending-плитка), диалог просмотра,
 * переключение мудборда и удаление через AlertDialog.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Images,
  Loader2,
  Maximize2,
  Pin,
  PinOff,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { GalleryTile } from "../images/gallery-data";
import { TileArt } from "../images/tile-art";
import { SelectableChip } from "../images/chip";
import { PaletteDialog } from "./palette-dialog";
import {
  BOARD_SIZE_PRESETS,
  SAMPLE_FRAME_PROMPTS,
  boardPresetById,
  isBoardTile,
  pendingBoardTile,
  pluralFrames,
  type FrameRequest,
} from "./palette-data";

export interface GeneratingInfo {
  prompt: string;
  sizeLabel: string;
  aspect: GalleryTile["aspect"];
}

export function MoodboardTab({
  tiles,
  loading,
  generating,
  onGenerate,
  onToggleBoard,
  onDelete,
}: {
  /** Готовые плитки воркспейса (image/portrait, свежие сверху). */
  tiles: GalleryTile[];
  loading: boolean;
  generating: GeneratingInfo | null;
  onGenerate: (request: FrameRequest) => void;
  onToggleBoard: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  /* Форма генерации. */
  const [prompt, setPrompt] = useState("");
  const [sizeId, setSizeId] = useState(BOARD_SIZE_PRESETS[0].id);
  const [elapsed, setElapsed] = useState(0);

  /* Просмотр и удаление. */
  const [viewTileId, setViewTileId] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(
    null,
  );

  const preset = boardPresetById(sizeId);
  const busy = generating !== null;
  const canGenerate = !busy && prompt.trim().length >= 3;

  /* Таймер плашки: сколько секунд студия уже рисует кадр. */
  useEffect(() => {
    if (!busy) return;
    const startedAt = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy]);

  const displayTiles = useMemo(
    () =>
      generating
        ? [
            pendingBoardTile(
              generating.prompt,
              generating.aspect,
              generating.sizeLabel,
            ),
            ...tiles,
          ]
        : tiles,
    [tiles, generating],
  );

  const viewTile = tiles.find((t) => t.id === viewTileId) ?? null;
  const deleteTile = tiles.find((t) => t.id === deleteCandidateId) ?? null;

  const boardCount = tiles.filter(isBoardTile).length;

  const submit = () => {
    if (!canGenerate) return;
    setElapsed(0);
    onGenerate({ prompt: prompt.trim(), size: preset.id });
  };

  const elapsedLabel = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div
      aria-label="Мудборд"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden"
    >
      {/* Панель генерации кадра */}
      <section
        aria-label="Панель генерации кадра"
        className="shrink-0 rounded-xl border bg-card p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label htmlFor="frame-prompt" className="text-sm font-medium">
            Промпт кадра
          </label>
          <span className="text-xs text-muted-foreground">
            Новый кадр сразу попадает в мудборд
          </span>
        </div>
        <Textarea
          id="frame-prompt"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="Опишите кадр-настроение: «ночная набережная, дождь, отражения огней в лужах…»"
          className="mt-2 resize-none"
        />

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Идеи:
          </span>
          {SAMPLE_FRAME_PROMPTS.map((s) => (
            <SelectableChip
              key={s.label}
              label={s.label}
              selected={prompt === s.prompt}
              onClick={() => setPrompt(prompt === s.prompt ? "" : s.prompt)}
              disabled={busy}
            />
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              Формат
            </span>
            <div
              className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5"
              role="group"
              aria-label="Формат кадра"
            >
              {BOARD_SIZE_PRESETS.map((p) => (
                <SelectableChip
                  key={p.id}
                  label={p.label}
                  hint={p.size}
                  selected={sizeId === p.id}
                  onClick={() => setSizeId(p.id)}
                  className={cn(sizeId === p.id && "tabular-nums")}
                />
              ))}
            </div>
          </div>
          <Button
            className="shrink-0 sm:ml-auto"
            onClick={submit}
            disabled={!canGenerate}
            aria-live="polite"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {busy ? "Студия рисует…" : "Сгенерировать кадр"}
          </Button>
        </div>

        {/* Плашка прогресса: генерация занимает ~30–45 секунд */}
        {busy && generating ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.06]"
          >
            <div className="flex items-center gap-3 px-3.5 py-3">
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
                aria-hidden="true"
              >
                <Sparkles className="size-4 animate-pulse" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  Студия рисует кадр…{" "}
                  <span className="ml-1 font-mono text-xs tabular-nums text-muted-foreground">
                    {elapsedLabel}
                  </span>
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  «{generating.prompt}» · {generating.sizeLabel} · обычно это
                  занимает 30–45 секунд
                </p>
              </div>
            </div>
            <div className="h-1 w-full overflow-hidden bg-primary/10">
              <div className="h-full w-1/3 animate-pulse bg-primary/50" />
            </div>
          </div>
        ) : null}
      </section>

      {/* Счётчик мудборда */}
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400"
          aria-live="polite"
        >
          <Pin className="size-3" aria-hidden="true" />
          В мудборде {boardCount} из {tiles.length}
        </span>
        <span className="text-xs text-muted-foreground">
          {pluralFrames(tiles.length)} галереи воркспейса
        </span>
      </div>

      {/* Сетка плиток: скелетоны при загрузке, пустое состояние без кадров */}
      {displayTiles.length === 0 && !loading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center">
          <Images
            className="size-8 text-muted-foreground/50"
            aria-hidden="true"
          />
          <p className="max-w-sm text-sm text-muted-foreground">
            В галерее воркспейса пока нет изображений — сгенерируйте первый
            кадр, и он сразу встанет в мудборд
          </p>
        </div>
      ) : (
        <div
          aria-label={loading ? "Мудборд загружается" : "Мудборд — сетка кадров"}
          className="vf-scroll min-h-0 flex-1 overflow-y-auto pr-1"
        >
          <div className="grid grid-cols-2 gap-3 pb-1 sm:grid-cols-3 xl:grid-cols-4">
            {loading
              ? Array.from({ length: 4 }, (_, i) => (
                  <figure key={i} className="space-y-2">
                    <Skeleton className="aspect-square w-full rounded-xl" />
                    <Skeleton className="h-3 w-4/5 rounded" />
                    <Skeleton className="h-2.5 w-2/5 rounded" />
                  </figure>
                ))
              : displayTiles.map((tile) => (
                  <BoardTileCard
                    key={tile.id}
                    tile={tile}
                    onOpen={() => setViewTileId(tile.id)}
                    onToggleBoard={() => onToggleBoard(tile.id)}
                    onDelete={() => setDeleteCandidateId(tile.id)}
                  />
                ))}
          </div>
        </div>
      )}

      {/* Диалог просмотра кадра (картинка крупно, промпт, meta) */}
      <PaletteDialog
        tile={viewTile}
        open={viewTile !== null}
        onOpenChange={(open) => {
          if (!open) setViewTileId(null);
        }}
        onToggleBoard={onToggleBoard}
      />

      {/* Подтверждение удаления */}
      <AlertDialog
        open={deleteCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidateId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить изображение?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTile
                ? `«${deleteTile.title}» исчезнет из галереи и мудборда. Действие необратимо.`
                : "Работа исчезнет из галереи и мудборда. Действие необратимо."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCandidateId) onDelete(deleteCandidateId);
                setDeleteCandidateId(null);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─────────────────────────── плитка ─────────────────────────── */

function BoardTileCard({
  tile,
  onOpen,
  onToggleBoard,
  onDelete,
}: {
  tile: GalleryTile;
  onOpen: () => void;
  onToggleBoard: () => void;
  onDelete: () => void;
}) {
  const inBoard = isBoardTile(tile);
  const pending = tile.status === "generating";

  return (
    <figure className="group/tile">
      <div
        role="button"
        tabIndex={pending ? -1 : 0}
        aria-label={pending ? "Кадр генерируется" : `Открыть «${tile.title}»`}
        aria-disabled={pending || undefined}
        onClick={() => {
          if (!pending) onOpen();
        }}
        onKeyDown={(e) => {
          if (!pending && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onOpen();
          }
        }}
        className="relative cursor-zoom-in rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <TileArt
          tile={tile}
          className={cn(
            "border shadow-sm transition-shadow duration-200 group-hover/tile:shadow-md",
            inBoard && "border-emerald-600/50 ring-2 ring-emerald-500/70",
          )}
        >
          {pending ? (
            <div className="absolute inset-0 flex animate-pulse flex-col items-center justify-center gap-2 bg-stone-200/95 dark:bg-stone-900/95">
              <Sparkles className="size-6 text-primary" aria-hidden="true" />
              <span className="px-2 text-center text-xs font-medium text-muted-foreground">
                Студия рисует кадр…
              </span>
            </div>
          ) : (
            <>
              <div className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-1 bg-black/50 p-1 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 focus-within:opacity-100 group-hover/tile:opacity-100">
                <TileAction label="Открыть кадр" onClick={onOpen}>
                  <Maximize2 className="size-3.5" aria-hidden="true" />
                </TileAction>
                <TileAction
                  label={inBoard ? "Убрать из мудборда" : "В мудборд"}
                  active={inBoard}
                  onClick={onToggleBoard}
                >
                  {inBoard ? (
                    <PinOff className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Pin className="size-3.5" aria-hidden="true" />
                  )}
                </TileAction>
                <TileAction label="Удалить" danger onClick={onDelete}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </TileAction>
              </div>
              {inBoard ? (
                <span
                  className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm"
                  aria-hidden="true"
                >
                  <Pin className="size-2.5" />
                  В мудборде
                </span>
              ) : null}
            </>
          )}
        </TileArt>
      </div>
      <figcaption className="mt-2 space-y-1.5">
        <p className="truncate text-xs font-medium" title={tile.title}>
          {tile.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex min-w-0 max-w-[65%] items-center truncate rounded-full border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            title={tile.prompt}
          >
            {tile.kind === "portrait" ? "Портрет" : "Изображение"}
          </span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
            {tile.sizeLabel}
          </span>
        </div>
      </figcaption>
    </figure>
  );
}

function TileAction({
  label,
  onClick,
  active,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "size-7 rounded-lg text-white/90 hover:bg-white/25 hover:text-white",
        danger && "hover:bg-rose-500/70",
        active && "text-emerald-300 hover:text-emerald-200",
      )}
    >
      {children}
    </Button>
  );
}
