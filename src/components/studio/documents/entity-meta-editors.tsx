"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ENTITY_SHEET_ADD_ATTRIBUTE,
  ENTITY_SHEET_ADD_LINK,
  ENTITY_SHEET_ADD_TAG,
  ENTITY_SHEET_NO_ATTRIBUTES,
  ENTITY_SHEET_NO_LINKS,
  ENTITY_SHEET_NO_PEERS,
  ENTITY_SHEET_NO_TAGS,
} from "@/lib/entity-copy";
import {
  MAX_ENTITY_ATTRIBUTES,
  MAX_ENTITY_TAGS,
} from "@/lib/entity-meta";
import type { EntityAttribute, EntityDto } from "@/lib/workspace-types";
import { ENTITY_KIND_META } from "./entities-data";

export function AttributesEditor({
  attributes,
  onChange,
}: {
  attributes: EntityAttribute[];
  onChange: (next: EntityAttribute[]) => void;
}) {
  const canAdd = attributes.length < MAX_ENTITY_ATTRIBUTES;

  function patchRow(index: number, patch: Partial<EntityAttribute>) {
    onChange(
      attributes.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  return (
    <section aria-label="Атрибуты">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Атрибуты
      </h4>
      <div className="mt-2 grid grid-cols-1 gap-1.5">
        {attributes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{ENTITY_SHEET_NO_ATTRIBUTES}</p>
        ) : (
          attributes.map((attribute, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <Input
                value={attribute.label}
                onChange={(event) => patchRow(index, { label: event.target.value })}
                placeholder="поле"
                aria-label={`Название атрибута ${index + 1}`}
                maxLength={60}
                className="h-8 flex-1 text-xs"
              />
              <Input
                value={attribute.value}
                onChange={(event) => patchRow(index, { value: event.target.value })}
                placeholder="значение"
                aria-label={`Значение атрибута ${index + 1}`}
                maxLength={300}
                className="h-8 flex-1 text-xs"
              />
              <button
                type="button"
                onClick={() => onChange(attributes.filter((_, i) => i !== index))}
                aria-label={`Убрать атрибут ${attribute.label || index + 1}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
      {canAdd ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1.5 h-7 px-2 text-xs"
          onClick={() => onChange([...attributes, { label: "", value: "" }])}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {ENTITY_SHEET_ADD_ATTRIBUTE}
        </Button>
      ) : null}
    </section>
  );
}

export function TagsEditor({
  tags,
  input,
  onChange,
  onInputChange,
  title = "Теги",
  emptyText = ENTITY_SHEET_NO_TAGS,
}: {
  tags: string[];
  input: string;
  onChange: (next: string[]) => void;
  onInputChange: (next: string) => void;
  title?: string;
  emptyText?: string;
}) {
  const canAdd = tags.length < MAX_ENTITY_TAGS;

  function commitDraft() {
    const names = input
      .split(/[,]+/)
      .map((t) => t.replace(/^#+/, "").trim())
      .filter(Boolean);
    if (names.length === 0) {
      onInputChange("");
      return;
    }
    const seen = new Set(tags.map((t) => t.toLowerCase()));
    const next = [...tags];
    for (const name of names) {
      if (next.length >= MAX_ENTITY_TAGS) break;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(name.slice(0, 40));
    }
    onChange(next);
    onInputChange("");
  }

  return (
    <section aria-label={title}>
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              #{tag}
              <button
                type="button"
                aria-label={`Убрать тег ${tag}`}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="rounded-full hover:text-foreground"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))
        )}
      </div>
      {canAdd ? (
        <Input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder={ENTITY_SHEET_ADD_TAG}
          aria-label={ENTITY_SHEET_ADD_TAG}
          maxLength={40}
          className="mt-1.5 h-8 text-xs"
        />
      ) : null}
    </section>
  );
}

export function LinksEditor({
  relatedIds,
  entityId,
  entities,
  onChange,
  onOpen,
}: {
  relatedIds: string[];
  entityId: string;
  entities: EntityDto[];
  onChange: (next: string[]) => void;
  onOpen: (id: string) => void;
}) {
  const related = relatedIds
    .map((id) => entities.find((candidate) => candidate.id === id))
    .filter((c): c is EntityDto => Boolean(c));
  const peers = entities.filter(
    (candidate) => candidate.id !== entityId && !relatedIds.includes(candidate.id),
  );

  return (
    <section aria-label="Связанные сущности">
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Связи
      </h4>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {related.length === 0 ? (
          <p className="text-xs text-muted-foreground">{ENTITY_SHEET_NO_LINKS}</p>
        ) : (
          related.map((item) => {
            const Icon = ENTITY_KIND_META[item.kind].icon;
            return (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <button
                  type="button"
                  onClick={() => onOpen(item.id)}
                  title={`Открыть «${item.name}»`}
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <Icon className="size-3" aria-hidden="true" />
                  {item.name}
                </button>
                <button
                  type="button"
                  aria-label={`Убрать связь «${item.name}»`}
                  onClick={() => onChange(relatedIds.filter((id) => id !== item.id))}
                  className="rounded-full hover:text-foreground"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </span>
            );
          })
        )}
      </div>
      {peers.length > 0 ? (
        <select
          aria-label={ENTITY_SHEET_ADD_LINK}
          value=""
          className="mt-1.5 h-8 w-full rounded-md border bg-background px-2 text-xs text-muted-foreground"
          onChange={(event) => {
            const id = event.target.value;
            if (id) onChange([...relatedIds, id]);
          }}
        >
          <option value="">{ENTITY_SHEET_ADD_LINK}</option>
          {peers.map((peer) => (
            <option key={peer.id} value={peer.id}>
              {peer.name}
            </option>
          ))}
        </select>
      ) : related.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{ENTITY_SHEET_NO_PEERS}</p>
      ) : null}
    </section>
  );
}
