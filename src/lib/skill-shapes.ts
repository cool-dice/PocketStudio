import { ALL_CATALOG, type SkillSource } from "@/lib/skills-catalog";

export interface SkillDto {
  id: string;
  catalogKey: string | null;
  name: string;
  description: string;
  version: string;
  source: SkillSource;
  skillMd: string;
  triggers: string[];
  icon: string;
  enabled: boolean;
  purchased: boolean;
  usedCount: number;
  updatedAt: string;
}

export interface StoreSkillDto {
  key: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  triggers: string[];
  rating: number;
  reviews: number;
  imported: boolean;
}

type SkillRow = {
  id: string;
  catalogKey: string | null;
  name: string;
  description: string;
  version: string;
  source: string;
  skillMd: string;
  triggers: string;
  icon: string;
  enabled: boolean;
  purchased: boolean;
  usedCount: number;
  updatedAt: Date;
};

function parseTriggers(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

const SOURCES: SkillSource[] = ["builtin", "created", "imported", "store"];

export function skillDto(row: SkillRow): SkillDto {
  const source = SOURCES.includes(row.source as SkillSource)
    ? (row.source as SkillSource)
    : "created";
  return {
    id: row.id,
    catalogKey: row.catalogKey,
    name: row.name,
    description: row.description,
    version: row.version,
    source,
    skillMd: row.skillMd,
    triggers: parseTriggers(row.triggers),
    icon: row.icon,
    enabled: row.enabled,
    purchased: row.purchased,
    usedCount: row.usedCount,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function storeDtos(ownedKeys: Set<string>): StoreSkillDto[] {
  return ALL_CATALOG.filter((s) => s.source === "store").map((s) => ({
    key: s.key,
    name: s.name,
    description: s.description,
    version: s.version,
    icon: s.icon,
    triggers: s.triggers,
    rating: s.rating ?? 4.5,
    reviews: s.reviews ?? 0,
    imported: ownedKeys.has(s.key),
  }));
}
