"use client";

/**
 * Вкладка «Альбом»: живые артефакты воркспейса (не MOCK_ALBUM).
 * Генерация, копия из библиотеки, избранное и удаление — через REST.
 * Пропавший /gen файл не становится кликабельной 404-ссылкой.
 */

import {
  ArrowUpDown,
  Check,
  FolderPlus,
  ImageIcon,
  ImageOff,
  Loader2,
  Search,
  Sparkles,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import {
  ALBUM_EMPTY,
  ALBUM_EMPTY_HINT,
  ALBUM_FAVORITE_FAILED,
  ALBUM_FILTER_EMPTY,
  ALBUM_FILTER_EMPTY_HINT,
  ALBUM_GENERATE_FAILED,
  ALBUM_GENERATE_FAILED_HINT,
  ALBUM_LOAD_ERROR,
  ALBUM_LOAD_ERROR_HINT,
  ALBUM_MISSING_FILE,
  ALBUM_MISSING_FILE_HINT,
  ALBUM_NO_WORKSPACE,
  ALBUM_NO_WORKSPACE_HINT,
  ALBUM_REMOVE_FAILED,
  ALBUM_REMOVE_OK,
  ALBUM_VARIATION_FAILED,
} from "@/lib/album-copy";
import {
  IMAGE_GEN_UNCONFIGURED_HINT,
  displayableImageSrc,
} from "@/lib/image-copy";
import type { ArtifactDto, EntityDto } from "@/lib/workspace-types";
import { GradientArt } from "./art-placeholder";
import { SelectableChip } from "./narrative-chip";
import {
  ALBUM_KIND_META,
  albumItemOf,
  isAlbumArtifact,
  type AlbumItem,
  type AlbumItemKind,
  type EntityNameHint,
} from "./album-data";
import { AlbumLibraryDialog } from "./album-library-dialog";
import { agoFromISO, pluralRu } from "./types";

type AlbumSort = "date" | "title";
type AlbumFilter = AlbumItemKind | "all" | "favorite";

const SORT_ITEMS: { id: AlbumSort; label: string }[] = [
  { id: "date", label: "по дате" },
  { id: "title", label: "по названию" },
];

const TYPE_FILTERS: { id: AlbumFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "portrait", label: "Портреты" },
  { id: "illustration", label: "Иллюстрации" },
  { id: "concept", label: "Концепты" },
  { id: "favorite", label: "Избранные" },
];

export function AlbumTab({
  workspaceId,
  onOpenEntity,
  onCountChange,
}: {
  workspaceId: string | null;
  onOpenEntity: (entityId: string) => void;
  onCountChange?: (count: number) => void;
}) {
  const [artifacts, setArtifacts] = useState<ArtifactDto[]>([]);
  const [entityHints, setEntityHints] = useState<Map<string, EntityNameHint>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AlbumFilter>("all");
  const [sort, setSort] = useState<AlbumSort>("date");
  const [openId, setOpenId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [variationId, setVariationId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const promptRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setArtifacts([]);
      setLoadError(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.listArtifacts(workspaceId).catch(() => null),
      api.listEntities(workspaceId).catch(() => null),
    ])
      .then(([arts, ents]) => {
        if (cancelled) return;
        if (arts) setArtifacts(arts.filter(isAlbumArtifact));
        if (ents) {
          setEntityHints(
            new Map(
              ents.map((entity: EntityDto) => [
                entity.id,
                { name: entity.name, isCharacter: entity.kind === "character" },
              ]),
            ),
          );
        }
        setLoadError(!arts);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const items = useMemo(
    () => artifacts.map((artifact) => albumItemOf(artifact, entityHints)),
    [artifacts, entityHints],
  );

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items, onCountChange]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (type !== "all" && (type === "favorite" ? !item.favorite : item.kind !== type)) {
        return false;
      }
      if (
        normalized &&
        !item.title.toLowerCase().includes(normalized) &&
        !(item.entityName ?? "").toLowerCase().includes(normalized)
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "ru")
        : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [items, query, type, sort]);

  const openItem = items.find((item) => item.id === openId) ?? null;
  const alreadyIds = useMemo(() => new Set(artifacts.map((a) => a.id)), [artifacts]);

  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!workspaceId || !trimmed || generating) return;
    setGenerating(true);
    try {
      const artifact = await api.aiGenerateImage({
        projectId: workspaceId,
        prompt: trimmed,
        title: trimmed.slice(0, 60),
        albumKind: "illustration",
      });
      if (!isAlbumArtifact(artifact) || !displayableImageSrc(artifact)) {
        toast.error(ALBUM_GENERATE_FAILED, { description: ALBUM_GENERATE_FAILED_HINT });
        return;
      }
      setArtifacts((prev) => [artifact, ...prev]);
      setPrompt("");
      toast.success("Иллюстрация готова", {
        description: "Тайл добавлен в начало альбома.",
      });
      promptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      const unconfigured =
        err instanceof ApiError && err.message === UNCONFIGURED_TOOL_MESSAGE;
      toast.error(err instanceof ApiError ? err.message : ALBUM_GENERATE_FAILED, {
        description: unconfigured
          ? IMAGE_GEN_UNCONFIGURED_HINT
          : ALBUM_GENERATE_FAILED_HINT,
      });
    } finally {
      setGenerating(false);
    }
  }

  async function handleVariation(item: AlbumItem) {
    if (!workspaceId || variationId) return;
    setVariationId(item.id);
    try {
      const artifact = await api.aiGenerateImage({
        projectId: workspaceId,
        prompt: item.prompt ?? `${item.title} — вариация: изменены ракурс, свет и палитра`,
        title: `${item.title} · вариация`,
        entityId: item.entityId ?? undefined,
        albumKind: item.kind,
      });
      if (!isAlbumArtifact(artifact) || !displayableImageSrc(artifact)) {
        toast.error(ALBUM_VARIATION_FAILED);
        return;
      }
      setArtifacts((prev) => [artifact, ...prev]);
      toast.success("Вариация готова", { description: "Новый тайл добавлен в начало альбома." });
    } catch (err) {
      const unconfigured =
        err instanceof ApiError && err.message === UNCONFIGURED_TOOL_MESSAGE;
      toast.error(err instanceof ApiError ? err.message : ALBUM_VARIATION_FAILED, {
        description: unconfigured ? IMAGE_GEN_UNCONFIGURED_HINT : undefined,
      });
    } finally {
      setVariationId(null);
    }
  }

  async function toggleFavorite(item: AlbumItem) {
    const next = !item.favorite;
    setArtifacts((prev) =>
      prev.map((artifact) =>
        artifact.id === item.id ? { ...artifact, favorite: next } : artifact,
      ),
    );
    try {
      const updated = await api.updateArtifact(item.id, { favorite: next });
      setArtifacts((prev) =>
        prev.map((artifact) => (artifact.id === updated.id ? updated : artifact)),
      );
    } catch {
      setArtifacts((prev) =>
        prev.map((artifact) =>
          artifact.id === item.id ? { ...artifact, favorite: item.favorite } : artifact,
        ),
      );
      toast.error(ALBUM_FAVORITE_FAILED);
    }
  }

  async function handleRemove(item: AlbumItem) {
    if (removingId) return;
    const snapshot = artifacts;
    setRemovingId(item.id);
    setArtifacts((prev) => prev.filter((artifact) => artifact.id !== item.id));
    if (openId === item.id) setOpenId(null);
    try {
      await api.deleteArtifact(item.id);
      toast.success(ALBUM_REMOVE_OK, { description: item.title });
    } catch {
      setArtifacts(snapshot);
      toast.error(ALBUM_REMOVE_FAILED);
    } finally {
      setRemovingId(null);
    }
  }

  if (!workspaceId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium">{ALBUM_NO_WORKSPACE}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{ALBUM_NO_WORKSPACE_HINT}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium">{ALBUM_LOAD_ERROR}</p>
        <p className="text-xs text-muted-foreground">{ALBUM_LOAD_ERROR_HINT}</p>
      </div>
    );
  }

  const albumEmpty = items.length === 0;
  const filterEmpty = !albumEmpty && visible.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold">Альбом</h3>
            <p className="text-xs text-muted-foreground">
              {items.length} {pluralRu(items.length, "работа", "работы", "работ")} · картинки
              воркспейса
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setLibraryOpen(true)}
            >
              <FolderPlus className="size-3.5" aria-hidden="true" />
              Из библиотеки
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <ArrowUpDown className="size-3" aria-hidden="true" />
                  {SORT_ITEMS.find((item) => item.id === sort)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SORT_ITEMS.map((item) => (
                  <DropdownMenuItem key={item.id} onClick={() => setSort(item.id)}>
                    <span className="flex w-full items-center justify-between">
                      {item.label}
                      {sort === item.id ? (
                        <Check className="size-3.5 text-primary" aria-hidden="true" />
                      ) : null}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div ref={promptRef} className="rounded-xl border bg-card p-3">
          <label htmlFor="album-prompt" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Сгенерировать иллюстрацию
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Textarea
              id="album-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Например: Тихая Пристань ночью, маяк сквозь метель, кинематографично…"
              aria-label="Промпт для генерации иллюстрации"
              rows={2}
              className="min-h-0 flex-1 resize-none rounded-lg text-sm"
            />
            <Button
              type="button"
              className="shrink-0"
              disabled={generating || prompt.trim().length < 3}
              onClick={() => void handleGenerate()}
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Рисуем…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden="true" />
                  Сгенерировать
                </>
              )}
            </Button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Живая генерация — обычно до минуты. Тайл появится первым.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию или сущности…"
              aria-label="Поиск по альбому"
              className="h-8 pl-8 pr-8 text-xs"
            />
            {query !== "" ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Очистить поиск"
                className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div
            className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0"
            role="group"
            aria-label="Фильтр по типу работы"
          >
            {TYPE_FILTERS.map((filter) => (
              <SelectableChip
                key={filter.id}
                label={filter.label}
                selected={type === filter.id}
                onClick={() => setType(filter.id)}
                count={
                  filter.id === "all"
                    ? items.length
                    : filter.id === "favorite"
                      ? items.filter((item) => item.favorite).length
                      : items.filter((item) => item.kind === filter.id).length
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {albumEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">{ALBUM_EMPTY}</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {ALBUM_EMPTY_HINT}
            </p>
          </div>
        ) : filterEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">{ALBUM_FILTER_EMPTY}</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {ALBUM_FILTER_EMPTY_HINT}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visible.map((item) => (
              <AlbumTile
                key={item.id}
                item={item}
                onOpen={() => setOpenId(item.id)}
                onToggleFavorite={() => void toggleFavorite(item)}
                onRemove={() => void handleRemove(item)}
                removing={removingId === item.id}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(openItem)} onOpenChange={(open) => !open && setOpenId(null)}>
        <DialogContent className="max-w-2xl gap-0 p-0 sm:rounded-xl">
          {openItem ? (
            <>
              <AlbumPreview item={openItem} className="aspect-[16/9] w-full rounded-t-xl border-b" />
              <div className="space-y-3 p-5">
                <DialogHeader className="space-y-1.5 text-left">
                  <DialogTitle className="font-serif text-lg leading-tight">
                    {openItem.title}
                  </DialogTitle>
                  <DialogDescription className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {ALBUM_KIND_META[openItem.kind].label}
                    </span>
                    {openItem.fileMissing ? (
                      <span className="text-xs text-destructive">{ALBUM_MISSING_FILE}</span>
                    ) : null}
                    {openItem.entityName ? (
                      <span className="text-xs">
                        Сущность:{" "}
                        <span className="font-medium text-foreground/80">{openItem.entityName}</span>
                      </span>
                    ) : null}
                    <span className="text-xs">{agoFromISO(openItem.createdAt)}</span>
                  </DialogDescription>
                </DialogHeader>

                {openItem.fileMissing ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {ALBUM_MISSING_FILE_HINT}
                  </p>
                ) : openItem.description || openItem.prompt ? (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {openItem.description ?? openItem.prompt}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    disabled={variationId !== null}
                    onClick={() => void handleVariation(openItem)}
                  >
                    {variationId === openItem.id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        Генерация вариации…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" aria-hidden="true" />
                        Сгенерировать вариацию
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void toggleFavorite(openItem)}
                    aria-pressed={openItem.favorite}
                  >
                    <Star className={cn("size-4", openItem.favorite && "fill-primary")} aria-hidden="true" />
                    {openItem.favorite ? "В избранном" : "В избранное"}
                  </Button>
                  {openItem.isCharacter && openItem.entityId ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setOpenId(null);
                        onOpenEntity(openItem.entityId!);
                      }}
                    >
                      <User className="size-4" aria-hidden="true" />
                      Открыть персонажа
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={removingId !== null}
                    onClick={() => void handleRemove(openItem)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    Убрать из альбома
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlbumLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        workspaceId={workspaceId}
        alreadyIds={alreadyIds}
        onAdded={(artifact) => {
          if (isAlbumArtifact(artifact)) {
            setArtifacts((prev) => [artifact, ...prev]);
          }
        }}
      />
    </div>
  );
}

function AlbumPreview({
  item,
  className,
  iconClassName,
}: {
  item: AlbumItem;
  className?: string;
  iconClassName?: string;
}) {
  const [broken, setBroken] = useState(false);
  const missing = item.fileMissing || broken || !item.url;

  if (!missing && item.url) {
    return (
      <img
        src={item.url}
        alt={item.title}
        className={cn("object-cover", className)}
        loading="lazy"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <GradientArt
      gradient={item.gradient}
      ariaLabel={
        item.fileMissing || broken
          ? `${ALBUM_MISSING_FILE}: ${item.title}`
          : `Заглушка работы: ${item.title}`
      }
      className={className}
      iconClassName={iconClassName}
    >
      {item.fileMissing || broken ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/35 text-white">
          <ImageOff className="size-6" aria-hidden="true" />
          <span className="px-2 text-center text-[11px] font-medium">{ALBUM_MISSING_FILE}</span>
        </div>
      ) : null}
    </GradientArt>
  );
}

function AlbumTile({
  item,
  onOpen,
  onToggleFavorite,
  onRemove,
  removing,
}: {
  item: AlbumItem;
  onOpen: () => void;
  onToggleFavorite: () => void;
  onRemove: () => void;
  removing: boolean;
}) {
  const kindMeta = ALBUM_KIND_META[item.kind];

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-sm">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <AlbumPreview item={item} className="aspect-square w-full" iconClassName="size-10" />
        <span
          className={cn(
            "absolute left-2 top-2 rounded-full border border-border/60 bg-background/80 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground backdrop-blur-sm",
          )}
        >
          {kindMeta.label.toLowerCase()}
        </span>
        <span className="absolute inset-x-0 bottom-14 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ImageIcon className="size-3" aria-hidden="true" />
          Открыть
        </span>
        <span className="block p-2.5">
          <span className="line-clamp-1 block text-xs font-medium">{item.title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {item.fileMissing ? `${ALBUM_MISSING_FILE} · ` : ""}
            {item.entityName ? `${item.entityName} · ` : ""}
            {agoFromISO(item.createdAt)}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleFavorite}
        aria-pressed={item.favorite}
        aria-label={item.favorite ? `Убрать «${item.title}» из избранного` : `Добавить «${item.title}» в избранное`}
        className={cn(
          "absolute right-2 top-2 flex size-6 items-center justify-center rounded-md border backdrop-blur-sm transition-colors",
          item.favorite
            ? "border-primary/50 bg-primary/20 text-primary"
            : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground",
        )}
      >
        <Star className={cn("size-3.5", item.favorite && "fill-primary")} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label={`Убрать «${item.title}» из альбома`}
        className="absolute right-2 top-10 flex size-6 items-center justify-center rounded-md border border-border/60 bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:text-destructive disabled:opacity-50"
      >
        {removing ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
