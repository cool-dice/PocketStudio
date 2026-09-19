"use client";

import { useState } from "react";

import {
  compactAttributes,
  compactTags,
  sameAttributes,
  sameStringList,
  uniqueRelated,
} from "@/lib/entity-meta";
import type { EntityAttribute, EntityDto } from "@/lib/workspace-types";

export type EntityDraftPatch = {
  name?: string;
  short?: string | null;
  description?: string;
  attributes?: EntityAttribute[];
  tags?: string[];
  related?: string[];
};

type DraftFields = {
  name: string;
  short: string;
  description: string;
  attributes: EntityAttribute[];
  tags: string[];
  tagDraft: string;
  related: string[];
};

const EMPTY_DRAFT: DraftFields = {
  name: "",
  short: "",
  description: "",
  attributes: [],
  tags: [],
  tagDraft: "",
  related: [],
};

const CLEAN: Record<keyof DraftFields, boolean> = {
  name: false,
  short: false,
  description: false,
  attributes: false,
  tags: false,
  tagDraft: false,
  related: false,
};

export function buildEntitySavePatch(
  draft: DraftFields,
  entity: EntityDto,
): EntityDraftPatch {
  return {
    name: draft.name.trim() || entity.name,
    short: draft.short.trim() || null,
    description: draft.description,
    attributes: compactAttributes(draft.attributes),
    tags: compactTags([...draft.tags, draft.tagDraft]),
    related: uniqueRelated(draft.related, entity.id),
  };
}

/** Draft: clean fields follow entity (aiDescribe), user edits win. */
export function useEntityDraft(entity: EntityDto | null) {
  const [raw, setRaw] = useState<DraftFields>(EMPTY_DRAFT);
  const [dirty, setDirty] = useState(CLEAN);

  const draft: DraftFields = {
    name: dirty.name ? raw.name : (entity?.name ?? ""),
    short: dirty.short ? raw.short : (entity?.short ?? ""),
    description: dirty.description ? raw.description : (entity?.description ?? ""),
    attributes: dirty.attributes ? raw.attributes : (entity?.attributes ?? []),
    tags: dirty.tags ? raw.tags : (entity?.tags ?? []),
    tagDraft: dirty.tagDraft ? raw.tagDraft : "",
    related: dirty.related ? raw.related : (entity?.related ?? []),
  };

  function update(patch: Partial<DraftFields>) {
    setDirty((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.keys(patch).map((key) => [key, true])),
    }));
    setRaw((prev) => ({ ...prev, ...patch }));
  }

  const isDirty =
    Boolean(entity) &&
    ((dirty.name && draft.name !== entity!.name) ||
      (dirty.short && draft.short !== (entity!.short ?? "")) ||
      (dirty.description && draft.description !== entity!.description) ||
      (dirty.attributes &&
        !sameAttributes(
          compactAttributes(draft.attributes),
          compactAttributes(entity!.attributes),
        )) ||
      (dirty.tags &&
        !sameStringList(
          compactTags([...draft.tags, draft.tagDraft]),
          compactTags(entity!.tags),
        )) ||
      (dirty.tagDraft && compactTags([draft.tagDraft]).length > 0) ||
      (dirty.related &&
        !sameStringList(
          uniqueRelated(draft.related, entity!.id),
          uniqueRelated(entity!.related ?? [], entity!.id),
        )));

  return { draft, update, isDirty };
}
