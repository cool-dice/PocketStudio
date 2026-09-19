"use client";

import { X } from "lucide-react";

import {
  ENTITY_SHEET_ADD_MENTION_CHAPTER,
  ENTITY_SHEET_ADD_MENTION_SECTION,
  ENTITY_SHEET_MENTION_LABEL,
  ENTITY_SHEET_MENTION_LINKED,
  ENTITY_SHEET_NO_REFS_NARRATIVE,
  ENTITY_SHEET_NO_REFS_PRODUCT,
  ENTITY_SHEET_NO_SECTIONS,
} from "@/lib/entity-copy";
import { mentionTitle } from "@/lib/entity-mentions";
import type { EntityDomain, MentionSectionOption } from "@/lib/workspace-types";

export function MentionsEditor({
  items,
  domain,
  sections,
  onChange,
}: {
  items: string[];
  domain: EntityDomain;
  sections: MentionSectionOption[];
  onChange: (next: string[]) => void;
}) {
  const kind = domain === "product" ? "section" : "chapter";
  const isNarrative = domain === "narrative";
  const linked = new Set(items);
  const peers = sections.filter((section) => !linked.has(section.id));
  const addLabel = isNarrative
    ? ENTITY_SHEET_ADD_MENTION_CHAPTER
    : ENTITY_SHEET_ADD_MENTION_SECTION;
  const emptyText = isNarrative
    ? ENTITY_SHEET_NO_REFS_NARRATIVE
    : ENTITY_SHEET_NO_REFS_PRODUCT;

  return (
    <section aria-label={isNarrative ? "Упоминания в главах" : "Разделы документации"}>
      <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {isNarrative ? "Упомянута в главах" : "Разделы документации"}
      </h4>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          items.map((item) => {
            const section = sections.find((candidate) => candidate.id === item);
            const source = section ? "linked" : "label";
            const title = mentionTitle(
              item,
              kind,
              section
                ? { id: section.id, title: section.title, documentTitle: section.documentTitle }
                : undefined,
            );
            return (
              <span
                key={item}
                className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <span className="truncate" title={section?.documentTitle ?? title}>
                  {title}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {source === "linked"
                    ? ENTITY_SHEET_MENTION_LINKED
                    : ENTITY_SHEET_MENTION_LABEL}
                </span>
                <button
                  type="button"
                  aria-label={`Убрать упоминание «${title}»`}
                  onClick={() => onChange(items.filter((id) => id !== item))}
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
          aria-label={addLabel}
          value=""
          className="mt-1.5 h-8 w-full rounded-md border bg-background px-2 text-xs text-muted-foreground"
          onChange={(event) => {
            const id = event.target.value;
            if (id) onChange([...items, id]);
          }}
        >
          <option value="">{addLabel}</option>
          {peers.map((section) => (
            <option key={section.id} value={section.id}>
              {section.documentTitle} · {section.title}
            </option>
          ))}
        </select>
      ) : items.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {ENTITY_SHEET_NO_SECTIONS}
        </p>
      ) : null}
    </section>
  );
}
