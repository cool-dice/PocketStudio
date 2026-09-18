"use client";

/**
 * Универсальная панель сущности: вид, полное описание, атрибуты,
 * связи, упоминания (главы или разделы документации) и мок-кнопка
 * «Сгенерировать описание» (спиннер ~1,5 с → абзац дописывается
 * в карточку + тост). Персонажи открываются в CharacterSheet — эта
 * панель для всех остальных видов. Здесь же живёт WipBadge, общий
 * для вкладок модуля «Документы».
 */

import { BookOpenText, Check, FileText, Link2, Loader2, MapPin, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { MiniChip } from "./narrative-chip";
import { agoLabel } from "./narrative-data";
import { ENTITY_KIND_META, getEntity, getEntitySet, type StudioEntity } from "./entities-data";

export function WipBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-px text-[10px] font-medium leading-none text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      В разработке
    </span>
  );
}

export function EntitySheet({
  setId,
  entityId,
  onClose,
  onOpenEntity,
  generated,
  generatingId,
  onGenerate,
}: {
  setId: string;
  entityId: string | null;
  onClose: () => void;
  onOpenEntity: (id: string) => void;
  generated: Record<string, string>;
  generatingId: string | null;
  onGenerate: (entity: StudioEntity) => void;
}) {
  const set = getEntitySet(setId);
  const entity = entityId && set ? getEntity(setId, entityId) : undefined;
  const meta = entity ? ENTITY_KIND_META[entity.kind] : null;
  const KindIcon = meta?.icon;
  const isNarrative = set?.domain === "narrative";
  const generatedText = entity ? generated[entity.id] : undefined;
  const isGenerating = entity ? generatingId === entity.id : false;

  return (
    <Sheet open={Boolean(entity)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        {entity && set && meta && KindIcon ? (
          <>
            <SheetHeader className="shrink-0 space-y-1 border-b px-5 pb-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
                  <KindIcon className="size-4" aria-hidden="true" />
                </span>
                <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {meta.label} · {set.label}
                </p>
              </div>
              <SheetTitle
                className={cn("text-left text-xl leading-tight", isNarrative && "font-serif")}
              >
                {entity.name}
              </SheetTitle>
              <SheetDescription className="text-left">{entity.short}</SheetDescription>
            </SheetHeader>

            <div className="vf-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Полное описание */}
              <section aria-label="Описание сущности">
                <p
                  className={cn(
                    "text-[15px] leading-[1.75] text-foreground/90",
                    isNarrative && "font-serif",
                  )}
                >
                  {entity.description}
                </p>
                {generatedText ? (
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.06] p-3.5">
                    <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
                      <Sparkles className="size-3" aria-hidden="true" />
                      Сгенерировано ИИ
                    </p>
                    <p
                      className={cn(
                        "text-[15px] leading-[1.75] text-foreground/90",
                        isNarrative && "font-serif",
                      )}
                    >
                      {generatedText}
                    </p>
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

              <Separator />

              {/* Связи */}
              <section aria-label="Связанные сущности">
                <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Link2 className="size-3.5" aria-hidden="true" />
                  Связи
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entity.related.map((relatedId) => {
                    const related = getEntity(set.id, relatedId);
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
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Нажмите на связь, чтобы перейти к сущности.
                </p>
              </section>

              <Separator />

              {/* Упоминания: главы романа или разделы документации */}
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
                  {entity.refs.items.map((ref) => (
                    <MiniChip
                      key={ref}
                      className="font-mono"
                      title={isNarrative ? `${set.label}, глава ${ref}` : `Раздел ${ref}`}
                    >
                      {isNarrative ? `гл. ${ref}` : ref}
                    </MiniChip>
                  ))}
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <BookOpenText className="size-3.5 shrink-0" aria-hidden="true" />
                  {set.label} — {isNarrative ? "черновик" : "текущая редакция"} · обновлена{" "}
                  {agoLabel(entity.updatedAgo)}
                </p>
              </section>

              {/* Теги */}
              <section aria-label="Теги сущности">
                <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Теги
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entity.tags.map((tag) => (
                    <MiniChip key={tag}>#{tag}</MiniChip>
                  ))}
                </div>
              </section>
            </div>

            {/* Действие генерации */}
            <div className="shrink-0 border-t px-5 py-3">
              <Button
                type="button"
                className="w-full"
                disabled={isGenerating || Boolean(generatedText)}
                onClick={() => onGenerate(entity)}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Генерация описания…
                  </>
                ) : generatedText ? (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Описание сгенерировано
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden="true" />
                    Сгенерировать описание
                  </>
                )}
                <WipBadge className="ml-1.5" />
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
