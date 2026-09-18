import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Boxes,
  FileText,
  Flag,
  Gem,
  History,
  KeyRound,
  ListChecks,
  MapPin,
  Plug,
  ScrollText,
  UserRound,
  Users,
} from "lucide-react";

import { GRADIENTS } from "./narrative-data";
import type { EntityDto, EntityDomain, EntityKind } from "@/lib/workspace-types";

/**
 * Сущности модуля «Документы» (Фаза A): источник данных — REST API
 * (EntityDto), здесь живут только маппинги видов/доменов, группировка
 * в наборы и хелперы для карточек и панелей.
 */

export type { EntityDomain, EntityKind };

/* ─────────────────────────── Мета видов ─────────────────────────── */

export const ENTITY_KIND_META: Record<
  EntityKind,
  { label: string; plural: string; icon: LucideIcon }
> = {
  character: { label: "Персонаж", plural: "Персонажи", icon: Users },
  location: { label: "Локация", plural: "Локации", icon: MapPin },
  event: { label: "Событие", plural: "События", icon: History },
  item: { label: "Предмет", plural: "Предметы", icon: Gem },
  faction: { label: "Фракция", plural: "Фракции", icon: Flag },
  rule: { label: "Правило", plural: "Правила", icon: ScrollText },
  user: { label: "Пользователь", plural: "Пользователи", icon: UserRound },
  role: { label: "Роль", plural: "Роли", icon: KeyRound },
  requirement: { label: "Требование", plural: "Требования", icon: ListChecks },
  module: { label: "Модуль", plural: "Модули", icon: Boxes },
  integration: { label: "Интеграция", plural: "Интеграции", icon: Plug },
};

/** Виды для конструктора «+ Сущность» — по домену. */
export const NARRATIVE_KINDS: EntityKind[] = [
  "character",
  "location",
  "event",
  "item",
  "faction",
  "rule",
];

export const PRODUCT_KINDS: EntityKind[] = [
  "user",
  "role",
  "requirement",
  "module",
  "integration",
];

export function kindsOfDomain(domain: EntityDomain): EntityKind[] {
  return domain === "product" ? PRODUCT_KINDS : NARRATIVE_KINDS;
}

/* ─────────────────────────── Наборы сущностей ─────────────────────────── */

export interface EntitySet {
  id: string;
  name: string;
  domain: EntityDomain;
  icon: LucideIcon;
  entities: EntityDto[];
}

/** Группировка сущностей воркспейса в наборы (по setId, порядок — по обновлению). */
export function entitySetsOf(entities: EntityDto[]): EntitySet[] {
  const order: string[] = [];
  const map = new Map<string, EntityDto[]>();
  for (const entity of entities) {
    if (!map.has(entity.setId)) {
      map.set(entity.setId, []);
      order.push(entity.setId);
    }
    map.get(entity.setId)!.push(entity);
  }
  return order.map((id) => {
    const list = map.get(id)!;
    const domain = list[0].domain;
    return {
      id,
      name: list[0].setName,
      domain,
      icon: domain === "product" ? FileText : BookOpenText,
      entities: list,
    };
  });
}

/** Уникальные виды набора в порядке следования записей. */
export function kindsOfSet(set: EntitySet): EntityKind[] {
  const kinds: EntityKind[] = [];
  for (const entity of set.entities) {
    if (!kinds.includes(entity.kind)) kinds.push(entity.kind);
  }
  return kinds;
}

/* ─────────────────────────── Хелперы карточек ─────────────────────────── */

/** Инициалы для портрета: «Хранитель Ольм» → «ХО». */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** Градиент для нового портрета/тайла — по индексу из палитры студии. */
export function gradientForIndex(index: number): string {
  return GRADIENTS[Math.abs(index) % GRADIENTS.length];
}

export type RoleCategory = "main" | "secondary" | "antagonist";

export const ROLE_CATEGORY_META: Record<RoleCategory, { single: string }> = {
  main: { single: "Главный герой" },
  secondary: { single: "Второстепенный герой" },
  antagonist: { single: "Антагонист" },
};

/** Категория персонажа из атрибутов (сид хранит её в «Категория»). */
export function roleCategoryOf(entity: EntityDto): RoleCategory {
  const value = entity.attributes.find((a) => a.label.toLowerCase().includes("катег"))?.value ?? "";
  const normalized = value.toLowerCase();
  if (normalized.includes("антагон")) return "antagonist";
  if (normalized.includes("главн")) return "main";
  return "secondary";
}

/** Подпись «упомянута в / разделы» для домена набора. */
export function refsLabel(domain: EntityDomain): { lead: string; format: (ref: string) => string } {
  return domain === "narrative"
    ? { lead: "упомянута в:", format: (ref) => `гл. ${ref}` }
    : { lead: "разделы:", format: (ref) => ref };
}
