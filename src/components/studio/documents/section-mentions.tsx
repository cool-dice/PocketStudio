"use client";

import { X } from "lucide-react";

import {
  ENTITY_SHEET_ADD_MENTION_CHAPTER,
  SECTION_MENTION_BIND,
  SECTION_MENTION_FOUND,
  ENTITY_SHEET_MENTION_LINKED,
  ENTITY_SHEET_NO_REFS_NARRATIVE,
} from "@/lib/entity-copy";
import { entitiesFoundInText } from "@/lib/entity-mentions";
import type { EntityDto } from "@/lib/workspace-types";

export function SectionMentionsBar({
  sectionId,
  draft,
  entities,
  onBind,
  onUnbind,
  busy,
}: {
  sectionId: string | null;
  draft: string;
  entities: EntityDto[];
  onBind: (entityId: string) => void;
  onUnbind: (entityId: string) => void;
  busy: boolean;
}) {
  if (!sectionId) return null;

  const linked = entities.filter((entity) =>
    entity.refs.items.includes(sectionId),
  );
  const linkedIds = new Set(linked.map((entity) => entity.id));
  const found = entitiesFoundInText(draft, entities, linkedIds);
  const peers = entities.filter((entity) => !linkedIds.has(entity.id));

  return (
    <div className="border-t bg-background/80 px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Сущности
          </span>
          {linked.length === 0 && found.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {ENTITY_SHEET_NO_REFS_NARRATIVE}
            </p>
          ) : null}
          {linked.map((entity) => (
            <span
              key={entity.id}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              <span className="truncate">{entity.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                {ENTITY_SHEET_MENTION_LINKED}
              </span>
              <button
                type="button"
                disabled={busy}
                aria-label={`Убрать привязку «${entity.name}»`}
                onClick={() => onUnbind(entity.id)}
                className="rounded-full hover:text-foreground disabled:opacity-50"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          {found.map((entity) => (
            <span
              key={`found-${entity.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-dashed bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              <span className="truncate">{entity.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                {SECTION_MENTION_FOUND}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onBind(entity.id)}
                className="text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
              >
                {SECTION_MENTION_BIND}
              </button>
            </span>
          ))}
        </div>
        {peers.length > 0 ? (
          <select
            aria-label={ENTITY_SHEET_ADD_MENTION_CHAPTER}
            value=""
            disabled={busy}
            className="h-7 max-w-xs rounded-md border bg-background px-2 text-[11px] text-muted-foreground"
            onChange={(event) => {
              const id = event.target.value;
              if (id) onBind(id);
            }}
          >
            <option value="">{ENTITY_SHEET_ADD_MENTION_CHAPTER}</option>
            {peers.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}
