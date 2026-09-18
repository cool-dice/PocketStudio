"use client";

/**
 * Карточка сущности в сетке вкладки «Сущности»: портрет-градиент и бейдж
 * роли для персонажей, вид и свежесть, теги, упоминания и связи-чипы.
 * Данные — EntityDto из REST API (Фаза A).
 */

import { cn } from "@/lib/utils";
import type { EntityDto } from "@/lib/workspace-types";
import { GradientArt } from "./art-placeholder";
import { MiniChip } from "./narrative-chip";
import { ENTITY_KIND_META, refsLabel, roleCategoryOf } from "./entities-data";
import { agoFromISO } from "./types";

export function EntityCard({
  entity,
  setEntities,
  hasPortraitUrl,
  onOpen,
  onOpenRelated,
}: {
  entity: EntityDto;
  /** Сущности набора — для имён связей. */
  setEntities: EntityDto[];
  hasPortraitUrl: boolean;
  onOpen: () => void;
  onOpenRelated: (id: string) => void;
}) {
  const meta = ENTITY_KIND_META[entity.kind];
  const KindIcon = meta.icon;
  const isNarrative = entity.domain === "narrative";
  const isCharacter = entity.kind === "character";
  const roleCategory = isCharacter ? roleCategoryOf(entity) : null;
  const refs = refsLabel(entity.domain);
  const related = (entity.related ?? [])
    .map((id) => setEntities.find((candidate) => candidate.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  return (
    <article className="group flex flex-col rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-sm">
      <button type="button" onClick={onOpen} className="flex-1 text-left">
        {entity.image ? (
          <div className="relative">
            <img
              src={entity.image}
              alt={`Сгенерированное изображение: ${entity.name}`}
              className="aspect-[5/3] w-full border-b object-cover"
              loading="lazy"
            />
            {roleCategory ? (
              <span
                className={cn(
                  "absolute left-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm",
                  roleCategory === "main" && "border-primary/50 bg-primary/20 text-primary",
                  roleCategory === "secondary" && "border-border bg-background/80 text-muted-foreground",
                  roleCategory === "antagonist" && "border-destructive/50 bg-destructive/15 text-destructive",
                )}
              >
                {roleCategory === "main" ? "главный" : roleCategory === "antagonist" ? "антагонист" : "второстепенный"}
              </span>
            ) : null}
            <span className="absolute right-2.5 top-2.5 rounded-full border border-primary/50 bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary backdrop-blur-sm">
              {entity.kind === "character" ? "портрет ИИ" : "иллюстрация ИИ"}
            </span>
          </div>
        ) : isCharacter && entity.portrait ? (
          <div className="relative">
            <GradientArt
              gradient={entity.portrait.gradient}
              initials={entity.portrait.initials}
              ariaLabel={`Портрет-заглушка: ${entity.name}`}
              className="aspect-[5/3] w-full border-b"
              iconClassName="text-5xl"
            />
            {roleCategory ? (
              <span
                className={cn(
                  "absolute left-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm",
                  roleCategory === "main" && "border-primary/50 bg-primary/20 text-primary",
                  roleCategory === "secondary" && "border-border bg-background/80 text-muted-foreground",
                  roleCategory === "antagonist" && "border-destructive/50 bg-destructive/15 text-destructive",
                )}
              >
                {roleCategory === "main" ? "главный" : roleCategory === "antagonist" ? "антагонист" : "второстепенный"}
              </span>
            ) : null}
            {hasPortraitUrl ? (
              <span className="absolute right-2.5 top-2.5 rounded-full border border-primary/50 bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary backdrop-blur-sm">
                портрет ИИ
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="p-4 pb-3">
          <div className="flex items-center gap-2">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <KindIcon className="size-4" />
            </span>
            <span className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {meta.label}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground/70">
              {agoFromISO(entity.updatedAt)}
            </span>
          </div>
          <h4
            className={cn(
              "mt-2.5 text-base font-semibold leading-tight",
              isNarrative && "font-serif",
            )}
          >
            {entity.name}
          </h4>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {entity.short ?? entity.description}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {entity.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
          {entity.refs.items.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground/80">{refs.lead}</span>
              {entity.refs.items.slice(0, 5).map((ref) => (
                <span
                  key={ref}
                  className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary"
                >
                  {refs.format(ref)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </button>

      {related.length > 0 ? (
        <div className="mt-auto border-t px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground/80">связи:</span>
            {related.slice(0, 2).map((relatedEntity) => (
              <MiniChip
                key={relatedEntity.id}
                onClick={() => onOpenRelated(relatedEntity.id)}
                title={`Открыть «${relatedEntity.name}»`}
                className="max-w-36"
              >
                <span className="truncate">{relatedEntity.name}</span>
              </MiniChip>
            ))}
            <button
              type="button"
              onClick={onOpen}
              className={cn(
                "ml-auto text-[11px] font-medium text-primary opacity-70 transition-opacity",
                "hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Открыть →
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
