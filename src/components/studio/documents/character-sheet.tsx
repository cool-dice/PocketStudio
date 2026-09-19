"use client";

/**
 * Панель персонажа (Фаза A, EntityDto из API): портрет-градиент
 * (или реальная картинка после генерации), редактируемая биография
 * и имя, черты-теги, связи-чипы, упоминания в главах. «Сгенерировать
 * портрет» — живой aiGenerateImage (~40 с): тайл появляется в Альбоме,
 * а картинка — и здесь. «Сгенерировать описание» — LLM (~15–20 с).
 */

import { Check, ImagePlus, Link2, Loader2, MapPin, Save, Sparkles, Trash2, X } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CHARACTER_SHEET_NO_LINKS,
  CHARACTER_SHEET_NO_PORTRAIT,
  CHARACTER_SHEET_NO_REFS,
  CHARACTER_SHEET_NO_TRAITS,
} from "@/lib/entity-copy";
import type { EntityDto } from "@/lib/workspace-types";
import { GradientArt } from "./art-placeholder";
import { MiniChip } from "./narrative-chip";
import { useEntityDraft, type EntityDraftPatch } from "./entity-sheet";
import { ENTITY_KIND_META, ROLE_CATEGORY_META, roleCategoryOf } from "./entities-data";
import { agoFromISO } from "./types";

export function CharacterSheet({
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
  portraitUrl,
  portraitError,
  onDelete,
}: {
  entity: EntityDto | null;
  entities: EntityDto[];
  onClose: () => void;
  onOpenEntity: (id: string) => void;
  onSave: (id: string, patch: EntityDraftPatch) => void;
  onDescribe: (entity: EntityDto) => void;
  describing: boolean;
  onGeneratePortrait: (entity: EntityDto) => void;
  onClearPortrait: (entity: EntityDto) => void;
  portraitGenerating: boolean;
  /** Персистентный URL портрета из БД (PS-6). */
  portraitUrl: string | null;
  portraitError: string | null;
  onDelete: (entity: EntityDto) => void;
}) {
  const { draft, update, isDirty } = useEntityDraft(entity);
  const roleMeta = entity ? ROLE_CATEGORY_META[roleCategoryOf(entity)] : null;

  function handleClose() {
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
        {entity ? (
          <>
            <SheetHeader className="shrink-0 space-y-2 border-b px-5 pb-4">
              <SheetTitle asChild>
                <input
                  value={draft.name}
                  onChange={(event) => update({ name: event.target.value })}
                  aria-label="Имя персонажа"
                  maxLength={120}
                  className="w-full rounded-lg bg-transparent text-left font-serif text-xl leading-tight outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
                />
              </SheetTitle>
              <SheetDescription asChild>
                <div className="space-y-1.5">
                  <Input
                    value={draft.short}
                    onChange={(event) => update({ short: event.target.value })}
                    placeholder="Кто он в истории? (подпись для карточек)"
                    aria-label="Короткая подпись персонажа"
                    maxLength={200}
                    className="h-8 border-none bg-transparent px-0 text-sm focus-visible:ring-0"
                  />
                  <p className="text-[11px] text-muted-foreground/70">
                    {roleMeta?.single ?? "Персонаж"} · набор «{entity.setName}»
                  </p>
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="vf-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Портрет */}
              <div className="relative">
                {portraitUrl ? (
                  <img
                    src={portraitUrl}
                    alt={`Сгенерированный портрет: ${entity.name}`}
                    className="aspect-[4/5] w-full rounded-xl border object-cover"
                  />
                ) : entity.portrait ? (
                  <GradientArt
                    gradient={entity.portrait.gradient}
                    initials={entity.portrait.initials}
                    ariaLabel={`Портрет-заглушка: ${entity.name}`}
                    className="aspect-[4/5] w-full rounded-xl border"
                    iconClassName="text-6xl"
                  />
                ) : (
                  <div className="flex aspect-[4/5] w-full items-center justify-center rounded-xl border bg-muted text-xs text-muted-foreground">
                    {CHARACTER_SHEET_NO_PORTRAIT}
                  </div>
                )}
                {portraitError ? (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {portraitError}
                  </p>
                ) : null}
                {portraitGenerating ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-background/70 backdrop-blur-sm">
                    <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                    <p className="text-xs font-medium">Рисуем портрет по описанию…</p>
                    <p className="text-[11px] text-muted-foreground">обычно до минуты</p>
                  </div>
                ) : portraitUrl ? (
                  <button
                    type="button"
                    onClick={() => onClearPortrait(entity)}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-full border bg-background/85 px-2.5 py-1 text-[10px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground"
                    title="Убрать картинку (останется градиент)"
                  >
                    <X className="size-3" aria-hidden="true" />
                    убрать
                  </button>
                ) : null}
              </div>

              {/* Биография */}
              <section aria-label="Биография">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Биография
                </h4>
                <Textarea
                  value={draft.description}
                  onChange={(event) => update({ description: event.target.value })}
                  placeholder="Опишите героя — или доверьте студии…"
                  aria-label="Биография персонажа"
                  rows={8}
                  className="mt-2 resize-y rounded-xl border bg-background font-serif text-[15px] leading-[1.75] text-foreground/90"
                />
                {describing ? (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 text-xs text-primary">
                    <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
                    Студия пишет биографию — обычно 15–20 секунд…
                  </div>
                ) : null}
              </section>

              <Separator />

              {/* Черты */}
              <section aria-label="Черты характера">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Черты
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entity.tags.length > 0 ? (
                    entity.tags.map((tag) => <MiniChip key={tag}>#{tag}</MiniChip>)
                  ) : (
                    <p className="text-xs text-muted-foreground">{CHARACTER_SHEET_NO_TRAITS}</p>
                  )}
                </div>
              </section>

              {/* Атрибуты */}
              {entity.attributes.length > 0 ? (
                <>
                  <Separator />
                  <section aria-label="Атрибуты персонажа">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Атрибуты
                    </h4>
                    <dl className="mt-2 grid grid-cols-1 gap-1.5">
                      {entity.attributes.map((attribute) => (
                        <div
                          key={attribute.label}
                          className="flex items-baseline justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                        >
                          <dt className="shrink-0 text-xs text-muted-foreground">{attribute.label}</dt>
                          <dd className="min-w-0 truncate text-right text-xs font-medium">
                            {attribute.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </>
              ) : null}

              <Separator />

              {/* Связи */}
              <section aria-label="Связи персонажа">
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
                    <p className="text-xs text-muted-foreground">{CHARACTER_SHEET_NO_LINKS}</p>
                  )}
                </div>
              </section>

              <Separator />

              {/* Упоминания */}
              <section aria-label="Упоминания в главах">
                <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  Упомянута в главах
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entity.refs.items.length > 0 ? (
                    entity.refs.items.map((ref) => (
                      <MiniChip key={ref} className="font-mono">
                        гл. {ref}
                      </MiniChip>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">{CHARACTER_SHEET_NO_REFS}</p>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  обновлена {agoFromISO(entity.updatedAt)}
                </p>
              </section>
            </div>

            {/* Действия */}
            <div className="shrink-0 space-y-2 border-t px-5 py-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  disabled={describing}
                  onClick={() => onDescribe(entity)}
                  className="w-full"
                >
                  {describing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Пишем…
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" aria-hidden="true" />
                      Описание
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={portraitGenerating}
                  onClick={() => onGeneratePortrait(entity)}
                  className="w-full"
                >
                  {portraitGenerating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Рисуем…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="size-4" aria-hidden="true" />
                      Портрет
                    </>
                  )}
                </Button>
              </div>
              {isDirty ? (
                <Button
                  type="button"
                  variant="ghost"
                  className={cn("w-full text-xs")}
                  onClick={() =>
                    onSave(entity.id, {
                      name: draft.name.trim() || entity.name,
                      short: draft.short.trim() || null,
                      description: draft.description,
                    })
                  }
                >
                  <Save className="size-3.5" aria-hidden="true" />
                  Сохранить правки
                </Button>
              ) : (
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                  <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  Все изменения сохранены
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive hover:text-destructive"
                disabled={describing || portraitGenerating}
                onClick={() => onDelete(entity)}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Удалить карточку
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
