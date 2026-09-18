"use client";

/**
 * Универсальная панель сущности (Фаза A, данные из REST API): вид и набор,
 * правка name/short/description (кнопка «Сохранить» + автосейв при
 * закрытии), «Сгенерировать описание» — живой LLM (~15–20 с, «Студия
 * пишет…»), блок персистентного изображения (PS-6: генерация по kind,
 * сохраняется в БД, живёт и после перезагрузки), атрибуты, теги, связи-чипы
 * и упоминания. Экспортирует хелпер useEntityDraft — общий для панелей
 * сущности и персонажа.
 */

import { BookOpenText, Check, FileText, ImagePlus, Link2, Loader2, MapPin, Save, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EntityDto } from "@/lib/workspace-types";
import { MiniChip } from "./narrative-chip";
import { ENTITY_KIND_META, refsLabel } from "./entities-data";
import { agoFromISO } from "./types";

export type EntityDraftPatch = {
  name?: string;
  short?: string | null;
  description?: string;
};

/** Драфт правок сущности: незагрязнённые поля следуют за entity (обновления
 *  из aiDescribe подхватываются сразу), правки пользователя — приоритет. */
export function useEntityDraft(entity: EntityDto | null) {
  const [raw, setRaw] = useState({ name: "", short: "", description: "" });
  const [dirty, setDirty] = useState({ name: false, short: false, description: false });

  const draft = {
    name: dirty.name ? raw.name : (entity?.name ?? ""),
    short: dirty.short ? raw.short : (entity?.short ?? ""),
    description: dirty.description ? raw.description : (entity?.description ?? ""),
  };

  function update(patch: Partial<{ name: string; short: string; description: string }>) {
    setDirty((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.keys(patch).map((key) => [key, true])),
    }));
    setRaw((prev) => ({ ...prev, ...patch }));
  }

  const isDirty =
    Boolean(entity) &&
    (dirty.name || dirty.short || dirty.description) &&
    Boolean(
      entity &&
        (draft.name !== entity.name ||
          draft.short !== (entity.short ?? "") ||
          draft.description !== entity.description),
    );

  return { draft, update, isDirty };
}

export function EntitySheet({
  entity,
  entities,
  onClose,
  onOpenEntity,
  onSave,
  onDescribe,
  describing,
  onGeneratePortrait,
  onClearPortrait,
  portraitGenerating,
}: {
  entity: EntityDto | null;
  /** Сущности набора — для имён связей. */
  entities: EntityDto[];
  onClose: () => void;
  onOpenEntity: (id: string) => void;
  onSave: (id: string, patch: EntityDraftPatch) => void;
  onDescribe: (entity: EntityDto) => void;
  describing: boolean;
  onGeneratePortrait: (entity: EntityDto) => void;
  onClearPortrait: (entity: EntityDto) => void;
  portraitGenerating: boolean;
}) {
  const { draft, update, isDirty } = useEntityDraft(entity);
  const meta = entity ? ENTITY_KIND_META[entity.kind] : null;
  const KindIcon = meta?.icon;
  const isNarrative = entity?.domain === "narrative";
  const refs = entity ? refsLabel(entity.domain) : null;

  function handleClose() {
    // Автосейв при закрытии: если были правки — сохраняем до закрытия.
    if (entity && isDirty) {
      onSave(entity.id, {
        name: draft.name.trim() || entity.name,
        short: draft.short.trim() || null,
        description: draft.description,
      });
    }
    onClose();
  }

  return (
    <Sheet open={Boolean(entity)} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        {entity && meta && KindIcon && refs ? (
          <>
            <SheetHeader className="shrink-0 space-y-2 border-b px-5 pb-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
                  <KindIcon className="size-4" aria-hidden="true" />
                </span>
                <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {meta.label} · {entity.setName}
                </p>
              </div>
              <SheetTitle asChild>
                <input
                  value={draft.name}
                  onChange={(event) => update({ name: event.target.value })}
                  aria-label="Название сущности"
                  maxLength={120}
                  className={cn(
                    "w-full rounded-lg bg-transparent text-left text-xl leading-tight outline-none transition-colors hover:bg-accent focus-visible:bg-accent",
                    isNarrative && "font-serif",
                  )}
                />
              </SheetTitle>
              <SheetDescription asChild>
                <div>
                  <Input
                    value={draft.short}
                    onChange={(event) => update({ short: event.target.value })}
                    placeholder="Короткая подпись (для карточек)…"
                    aria-label="Короткая подпись"
                    maxLength={200}
                    className="h-8 border-none bg-transparent px-0 text-sm focus-visible:ring-0"
                  />
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="vf-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Изображение (PS-6): персистентная генерация по kind */}
              {isNarrative ? (
                <div className="relative">
                  {entity.image ? (
                    <img
                      src={entity.image}
                      alt={`Сгенерированное изображение: ${entity.name}`}
                      className={cn(
                        "w-full rounded-xl border object-cover",
                        entity.kind === "character" ? "aspect-[4/5]" : "aspect-[16/10]",
                      )}
                    />
                  ) : (
                    <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-muted/40 text-center">
                      <ImagePlus className="size-5 text-muted-foreground" aria-hidden="true" />
                      <p className="text-xs text-muted-foreground">
                        Студия может нарисовать {meta.label.toLowerCase()} по описанию
                      </p>
                    </div>
                  )}
                  {portraitGenerating ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-background/70 backdrop-blur-sm">
                      <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                      <p className="text-xs font-medium">Рисуем по описанию…</p>
                      <p className="text-[11px] text-muted-foreground">обычно до минуты</p>
                    </div>
                  ) : entity.image ? (
                    <button
                      type="button"
                      onClick={() => onClearPortrait(entity)}
                      className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border bg-background/85 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
                      title="Убрать картинку"
                    >
                      <X className="size-3" aria-hidden="true" />
                      убрать
                    </button>
                  ) : null}
                </div>
              ) : null}

              <section aria-label="Описание сущности">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Описание
                </h4>
                <Textarea
                  value={draft.description}
                  onChange={(event) => update({ description: event.target.value })}
                  placeholder="Опишите сущность — или доверьте студии…"
                  aria-label="Описание сущности"
                  rows={7}
                  className={cn(
                    "mt-2 resize-y rounded-xl border bg-background text-[15px] leading-[1.75] text-foreground/90",
                    isNarrative && "font-serif",
                  )}
                />
                {describing ? (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 text-xs text-primary">
                    <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                    Студия пишет описание — обычно 15–20 секунд…
                  </div>
                ) : null}
              </section>

              <Separator />

              {/* Атрибуты */}
              <section aria-label="Атрибуты">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Атрибуты
                </h4>
                <dl className="mt-2 grid grid-cols-1 gap-1.5">
                  {entity.attributes.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Атрибутов пока нет.</p>
                  ) : (
                    entity.attributes.map((attribute) => (
                      <div
                        key={attribute.label}
                        className="flex items-baseline justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                      >
                        <dt className="shrink-0 text-xs text-muted-foreground">{attribute.label}</dt>
                        <dd className="min-w-0 truncate text-right text-xs font-medium">
                          {attribute.value}
                        </dd>
                      </div>
                    ))
                  )}
                </dl>
              </section>

              <Separator />

              {/* Связи */}
              <section aria-label="Связанные сущности">
                <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Link2 className="size-3.5" aria-hidden="true" />
                  Связи
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entity.related && entity.related.length > 0 ? (
                    entity.related.map((relatedId) => {
                      const related = entities.find((candidate) => candidate.id === relatedId);
                      if (!related) return null;
                      const RelatedIcon = ENTITY_KIND_META[related.kind].icon;
                      return (
                        <MiniChip
                          key={relatedId}
                          onClick={() => onOpenEntity(relatedId)}
                          title={`Открыть «${related.name}»`}
                        >
                          <RelatedIcon className="size-3" aria-hidden="true" />
                          {related.name}
                        </MiniChip>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground">Связей пока нет.</p>
                  )}
                </div>
              </section>

              <Separator />

              {/* Упоминания: главы или разделы документации */}
              <section aria-label={isNarrative ? "Упоминания в главах" : "Разделы документации"}>
                <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {isNarrative ? (
                    <MapPin className="size-3.5" aria-hidden="true" />
                  ) : (
                    <FileText className="size-3.5" aria-hidden="true" />
                  )}
                  {isNarrative ? "Упомянута в главах" : "Разделы документации"}
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entity.refs.items.length > 0 ? (
                    entity.refs.items.map((ref) => (
                      <MiniChip key={ref} className="font-mono">
                        {refs.format(ref)}
                      </MiniChip>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Упоминаний пока нет.</p>
                  )}
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <BookOpenText className="size-3.5 shrink-0" aria-hidden="true" />
                  {entity.setName} · обновлена {agoFromISO(entity.updatedAt)}
                </p>
              </section>

              {/* Теги */}
              <section aria-label="Теги сущности">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Теги
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entity.tags.length > 0 ? (
                    entity.tags.map((tag) => <MiniChip key={tag}>#{tag}</MiniChip>)
                  ) : (
                    <p className="text-xs text-muted-foreground">Тегов пока нет.</p>
                  )}
                </div>
              </section>
            </div>

            {/* Действия */}
            <div className="shrink-0 space-y-2 border-t px-5 py-3">
              {isNarrative ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={describing || portraitGenerating}
                  onClick={() => onGeneratePortrait(entity)}
                >
                  {portraitGenerating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Рисуем…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="size-4" aria-hidden="true" />
                      {entity.image ? "Перерисовать изображение" : "Нарисовать изображение"}
                    </>
                  )}
                </Button>
              ) : null}
              <Button
                type="button"
                className="w-full"
                disabled={describing}
                onClick={() => onDescribe(entity)}
              >
                {describing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Студия пишет…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden="true" />
                    Сгенерировать описание
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!isDirty}
                onClick={() =>
                  onSave(entity.id, {
                    name: draft.name.trim() || entity.name,
                    short: draft.short.trim() || null,
                    description: draft.description,
                  })
                }
              >
                {isDirty ? (
                  <>
                    <Save className="size-4" aria-hidden="true" />
                    Сохранить правки
                  </>
                ) : (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Все изменения сохранены
                  </>
                )}
              </Button>
            </div>
          </>
        ) : entity === null ? null : (
          <div className="space-y-4 px-5 py-6">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
