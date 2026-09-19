"use client";

/**
 * Вкладка «Сущности» (Фаза A): записи воркспейса из REST API. Наборы
 * (по setId) — чипы-переключатели; виды со счётчиками, поиск, сортировка.
 * Карточки открываются в панелях: персонажи — CharacterSheet (портрет,
 * aiGenerateImage), остальные — EntitySheet (правка, aiDescribe).
 * «+ Сущность» — диалог создания (домен → вид → название).
 */

import { ArrowUpDown, Check, Plus, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { UNCONFIGURED_TOOL_MESSAGE } from "@/lib/ai/tools";
import {
  ENTITY_DELETE_CONFIRM_LEAD,
  ENTITY_DELETE_FAILED,
  ENTITY_DELETED,
  ENTITY_PORTRAIT_FAILED,
  ENTITY_PORTRAIT_FAILED_HINT,
  ENTITY_PORTRAIT_UNCONFIGURED_HINT,
  ENTITY_TAB_EMPTY,
  ENTITY_TAB_EMPTY_HINT,
  ENTITY_TAB_FILTER_EMPTY,
  ENTITY_TAB_FILTER_EMPTY_HINT,
  ENTITY_TAB_LOAD_ERROR,
  ENTITY_TAB_LOAD_ERROR_HINT,
} from "@/lib/entity-copy";
import type { EntityDto } from "@/lib/workspace-types";
import { CharacterSheet } from "./character-sheet";
import { EntityCard } from "./entity-card";
import { EntitySheet, type EntityDraftPatch } from "./entity-sheet";
import { EntityCreateDialog, type CreateEntityPayload } from "./entity-create-dialog";
import { SelectableChip } from "./narrative-chip";
import { ENTITY_KIND_META, entitySetsOf, kindsOfSet } from "./entities-data";
import { pluralRu } from "./types";

type EntitySort = "title" | "updated";

const SORT_ITEMS: { id: EntitySort; label: string }[] = [
  { id: "updated", label: "по обновлению" },
  { id: "title", label: "по названию" },
];

export function EntitiesTab({
  workspaceId,
  focusEntityId,
  onCountChange,
}: {
  workspaceId: string | null;
  focusEntityId: string | null;
  onCountChange?: (count: number) => void;
}) {
  const [entities, setEntities] = useState<EntityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [setId, setSetId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [sort, setSort] = useState<EntitySort>("updated");
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [describingId, setDescribingId] = useState<string | null>(null);
  const [portraitGenId, setPortraitGenId] = useState<string | null>(null);
  const [portraitError, setPortraitError] = useState<string | null>(null);

  const loadEntities = useCallback(async () => {
    if (!workspaceId) {
      setEntities([]);
      setLoading(false);
      setLoadError(false);
      return;
    }
    setLoading(true);
    try {
      const list = await api.listEntities(workspaceId);
      setEntities(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadEntities();
  }, [loadEntities]);

  const sets = useMemo(() => entitySetsOf(entities), [entities]);
  const activeSet = sets.find((set) => set.id === setId) ?? sets[0] ?? null;

  // Смена списка наборов: держим валидный выбор (или фокус из альбома).
  useEffect(() => {
    if (focusEntityId) {
      const owner = entities.find((entity) => entity.id === focusEntityId);
      if (owner) {
        setSetId(owner.setId);
        setOpenId(owner.id);
        return;
      }
    }
    if (!sets.some((set) => set.id === setId)) setSetId(sets[0]?.id ?? null);
  }, [entities, focusEntityId]);

  useEffect(() => {
    onCountChange?.(entities.length);
  }, [entities, onCountChange]);

  const kinds = useMemo(() => (activeSet ? kindsOfSet(activeSet) : []), [activeSet]);

  const visible = useMemo(() => {
    if (!activeSet) return [];
    const normalized = query.trim().toLowerCase();
    const filtered = activeSet.entities.filter((entity) => {
      if (kind !== "all" && entity.kind !== kind) return false;
      if (
        normalized &&
        !entity.name.toLowerCase().includes(normalized) &&
        !(entity.short ?? "").toLowerCase().includes(normalized) &&
        !entity.tags.some((tag) => tag.toLowerCase().includes(normalized))
      ) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) =>
      sort === "title"
        ? a.name.localeCompare(b.name, "ru")
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [activeSet, query, kind, sort]);

  const openEntity = openId ? entities.find((entity) => entity.id === openId) ?? null : null;

  useEffect(() => {
    setPortraitError(null);
  }, [openId]);

  /* ── Мутации и AI ── */

  const handleSave = useCallback(async (id: string, patch: EntityDraftPatch) => {
    try {
      const updated = await api.updateEntity(id, patch);
      setEntities((prev) => prev.map((entity) => (entity.id === id ? updated : entity)));
      toast.success("Сохранено", {
        description: `Карточка «${updated.name}» обновлена.`,
      });
    } catch {
      toast.error("Не удалось сохранить сущность");
    }
  }, []);

  const handleDescribe = useCallback(async (entity: EntityDto) => {
    if (describingId) return;
    setDescribingId(entity.id);
    try {
      const { description } = await api.aiDescribe(entity.id);
      setEntities((prev) =>
        prev.map((candidate) =>
          candidate.id === entity.id ? { ...candidate, description } : candidate,
        ),
      );
      toast.success("Описание готово", {
        description: `Студия вписала текст в карточку «${entity.name}».`,
      });
    } catch {
      toast.error("Не удалось сгенерировать описание", {
        description: "Попробуйте ещё раз через минуту.",
      });
    } finally {
      setDescribingId(null);
    }
  }, [describingId]);

  const handleGeneratePortrait = useCallback(
    async (entity: EntityDto) => {
      if (portraitGenId) return;
      setPortraitGenId(entity.id);
      setPortraitError(null);
      try {
        const { entity: updated } = await api.generateEntityPortrait(entity.id);
        setEntities((prev) =>
          prev.map((candidate) => (candidate.id === entity.id ? updated : candidate)),
        );
        toast.success("Портрет готов", {
          description: "Карточка сохранена с картинкой — тайл появился в Альбоме.",
        });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : ENTITY_PORTRAIT_FAILED;
        setPortraitError(message);
        toast.error(message, {
          description:
            message === UNCONFIGURED_TOOL_MESSAGE
              ? ENTITY_PORTRAIT_UNCONFIGURED_HINT
              : ENTITY_PORTRAIT_FAILED_HINT,
        });
      } finally {
        setPortraitGenId(null);
      }
    },
    [portraitGenId],
  );

  const handleClearPortrait = useCallback(async (entity: EntityDto) => {
    try {
      const updated = await api.clearEntityPortrait(entity.id);
      setEntities((prev) => prev.map((c) => (c.id === entity.id ? updated : c)));
      toast.success("Картинка убрана", {
        description: "Осталась заглушка-градиент — портрет можно сгенерировать снова.",
      });
    } catch {
      toast.error("Не удалось убрать портрет");
    }
  }, []);

  const handleCreate = useCallback(
    async (payload: CreateEntityPayload) => {
      if (!workspaceId) return;
      try {
        const created = await api.createEntity(workspaceId, payload);
        setEntities((prev) => [created, ...prev]);
        setSetId(created.setId);
        setKind("all");
        setOpenId(created.id);
        toast.success("Сущность создана", {
          description: `«${created.name}» добавлена в набор «${created.setName}».`,
        });
      } catch {
        toast.error("Не удалось создать сущность");
        throw new Error("Не удалось создать сущность");
      }
    },
    [workspaceId],
  );

  const handleDelete = useCallback(async (entity: EntityDto) => {
    if (!window.confirm(`${ENTITY_DELETE_CONFIRM_LEAD} «${entity.name}»?`)) return;
    try {
      await api.deleteEntity(entity.id);
      setEntities((prev) => prev.filter((candidate) => candidate.id !== entity.id));
      setOpenId(null);
      toast.success(ENTITY_DELETED);
    } catch {
      toast.error(ENTITY_DELETE_FAILED);
    }
  }, []);

  function switchSet(nextId: string) {
    if (nextId === setId) return;
    setSetId(nextId);
    setQuery("");
    setKind("all");
    setOpenId(null);
  }

  /* ── Рендер ── */

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 px-4 py-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-sm font-medium">{ENTITY_TAB_LOAD_ERROR}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{ENTITY_TAB_LOAD_ERROR_HINT}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => void loadEntities()}>
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Каталогизация */}
      <div className="shrink-0 space-y-3 border-b bg-muted/30 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Сущности</h3>
            <p className="text-xs text-muted-foreground">
              {entities.length > 0
                ? `${entities.length} ${pluralRu(entities.length, "запись", "записи", "записей")} воркспейса · виды меняются под задачу: от лора мира до ролей и требований`
                : "записей пока нет — создайте первую"}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
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
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Сущность
            </Button>
          </div>
        </div>

        {/* Переключатель наборов */}
        {sets.length > 0 ? (
          <div
            className="vf-scroll-x flex items-center gap-1.5 overflow-x-auto pb-0.5"
            role="group"
            aria-label="Набор сущностей"
          >
            {sets.map((set) => (
              <SelectableChip
                key={set.id}
                label={set.name}
                icon={set.icon}
                selected={activeSet?.id === set.id}
                onClick={() => switchSet(set.id)}
                count={set.entities.length}
              />
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию или тегу…"
              aria-label="Поиск по сущностям"
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
            aria-label="Фильтр по виду сущности"
          >
            <SelectableChip
              label="Все"
              selected={kind === "all"}
              onClick={() => setKind("all")}
              count={activeSet?.entities.length ?? 0}
            />
            {kinds.map((kindId) => (
              <SelectableChip
                key={kindId}
                label={ENTITY_KIND_META[kindId].plural}
                selected={kind === kindId}
                onClick={() => setKind(kindId)}
                count={activeSet?.entities.filter((entity) => entity.kind === kindId).length ?? 0}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Сетка карточек */}
      <div className="vf-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {entities.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">{ENTITY_TAB_EMPTY}</p>
            <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
              {ENTITY_TAB_EMPTY_HINT}
            </p>
            <Button type="button" size="sm" className="mt-1" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              Сущность
            </Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-sm font-medium">{ENTITY_TAB_FILTER_EMPTY}</p>
            <p className="text-xs text-muted-foreground">{ENTITY_TAB_FILTER_EMPTY_HINT}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                setEntities={activeSet?.entities ?? []}
                hasPortraitUrl={Boolean(entity.image)}
                onOpen={() => setOpenId(entity.id)}
                onOpenRelated={(id) => setOpenId(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Детальные панели */}
      {openEntity?.kind === "character" ? (
        <CharacterSheet
          key={openEntity.id}
          entity={openEntity}
          entities={entities}
          onClose={() => setOpenId(null)}
          onOpenEntity={(id) => setOpenId(id)}
          onSave={handleSave}
          onDescribe={handleDescribe}
          describing={openEntity ? describingId === openEntity.id : false}
          onGeneratePortrait={handleGeneratePortrait}
          onClearPortrait={handleClearPortrait}
          portraitGenerating={portraitGenId === openEntity.id}
          portraitUrl={openEntity.image}
          portraitError={portraitError}
          onDelete={handleDelete}
        />
      ) : (
        <EntitySheet
          key={openEntity?.id ?? "none"}
          entity={openEntity}
          entities={entities}
          onClose={() => setOpenId(null)}
          onOpenEntity={(id) => setOpenId(id)}
          onSave={handleSave}
          onDescribe={handleDescribe}
          describing={openEntity ? describingId === openEntity.id : false}
          onGeneratePortrait={handleGeneratePortrait}
          onClearPortrait={handleClearPortrait}
          portraitGenerating={openEntity ? portraitGenId === openEntity.id : false}
          portraitError={portraitError}
          onDelete={handleDelete}
        />
      )}

      {/* Создание */}
      <EntityCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={handleCreate}
        sets={sets}
        activeSetId={activeSet?.id ?? null}
      />
    </div>
  );
}
