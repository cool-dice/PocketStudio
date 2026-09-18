"use client";

/**
 * Панель сущности кодекса: полное описание, атрибуты, связи,
 * упоминания в главах и мок-кнопка «Сгенерировать описание»
 * (спиннер ~1,5 с → абзац дописывается в карточку + тост).
 */

import { BookOpenText, Check, Link2, Loader2, MapPin, Sparkles } from "lucide-react";

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
import {
  GENERATED_LORE_TEMPLATES,
  LORE_CATEGORY_META,
  agoLabel,
  getLoreEntity,
  type LoreEntity,
} from "./narrative-data";

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

export function CodexEntitySheet({
  entityId,
  onClose,
  onOpenEntity,
  generated,
  generatingId,
  onGenerate,
}: {
  entityId: string | null;
  onClose: () => void;
  onOpenEntity: (id: string) => void;
  generated: Record<string, string>;
  generatingId: string | null;
  onGenerate: (entity: LoreEntity) => void;
}) {
  const entity = entityId ? getLoreEntity(entityId) : undefined;
  const meta = entity ? LORE_CATEGORY_META[entity.category] : null;
  const CategoryIcon = meta?.icon;
  const generatedText = entity ? generated[entity.id] : undefined;
  const isGenerating = entity ? generatingId === entity.id : false;

  return (
    <Sheet open={Boolean(entity)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        {entity && meta && CategoryIcon ? (
          <>
            <SheetHeader className="shrink-0 space-y-1 border-b px-5 pb-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
                  <CategoryIcon className="size-4" aria-hidden="true" />
                </span>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {meta.label} кодекса · {agoLabel(entity.updatedAgo)}
                </p>
              </div>
              <SheetTitle className="text-left font-serif text-xl leading-tight">
                {entity.name}
              </SheetTitle>
              <SheetDescription className="text-left">{entity.short}</SheetDescription>
            </SheetHeader>

            <div className="vf-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
              {/* Полное описание */}
              <section aria-label="Описание сущности">
                <p className="font-serif text-[15px] leading-[1.75] text-foreground/90">
                  {entity.description}
                </p>
                {generatedText ? (
                  <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.06] p-3.5">
                    <p className="mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-primary">
                      <Sparkles className="size-3" aria-hidden="true" />
                      Сгенерировано ИИ
                    </p>
                    <p className="font-serif text-[15px] leading-[1.75] text-foreground/90">
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
                    const related = getLoreEntity(relatedId);
                    if (!related) return null;
                    const RelatedIcon = LORE_CATEGORY_META[related.category].icon;
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

              {/* Упоминания в главах */}
              <section aria-label="Упоминания в главах">
                <h4 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  Упомянута в главах
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entity.chapters.map((chapter) => (
                    <MiniChip key={chapter} title={`Хроники Долгой Зимы, глава ${chapter}`}>
                      гл. {chapter}
                    </MiniChip>
                  ))}
                </div>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <BookOpenText className="size-3.5 shrink-0" aria-hidden="true" />
                  «Хроники Долгой Зимы» — черновик
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
