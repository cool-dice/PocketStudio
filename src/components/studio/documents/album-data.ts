import type { ArtifactDto } from "@/lib/workspace-types";
import { GRADIENTS } from "./narrative-data";

/**
 * Альбом (Фаза A): артефакты воркспейса из REST API (ArtifactDto).
 * Тайл показывает реальную картинку (artifact.url) либо градиент-
 * заглушку (meta.gradient). Классификация: meta.albumKind при сгенери-
 * рованном сиде, иначе image+entityId → портрет, image → иллюстрация.
 */

export type AlbumItemKind = "portrait" | "illustration" | "concept";

export const ALBUM_KIND_META: Record<
  AlbumItemKind,
  { label: string; plural: string }
> = {
  portrait: { label: "Портрет", plural: "Портреты" },
  illustration: { label: "Иллюстрация", plural: "Иллюстрации" },
  concept: { label: "Концепт", plural: "Концепты" },
};

/** Доступ к мета-полю артефакта (JSON на бэкенде). */
function metaOf(artifact: ArtifactDto, key: string): string | null {
  const meta = artifact.meta;
  if (!meta || typeof meta !== "object") return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/** Артефакт принадлежит альбому: картинка/портрет с мета-видом, url или пропавшим файлом. */
export function isAlbumArtifact(artifact: ArtifactDto): boolean {
  if (metaOf(artifact, "albumKind") !== null) return true;
  const visual = ["image", "portrait", "illustration", "concept"];
  if (!visual.includes(artifact.type)) return false;
  return Boolean(artifact.url) || Boolean(artifact.fileMissing);
}

function kindOf(artifact: ArtifactDto): AlbumItemKind {
  const albumKind = metaOf(artifact, "albumKind");
  if (albumKind === "portrait" || albumKind === "illustration" || albumKind === "concept") {
    return albumKind;
  }
  if (artifact.type === "portrait" || (artifact.type === "image" && artifact.entityId)) {
    return "portrait";
  }
  return "illustration";
}

/** Стабильный индекс для градиента-заглушки по id артефакта. */
function gradientIndexOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export interface AlbumItem {
  id: string;
  kind: AlbumItemKind;
  title: string;
  entityId: string | null;
  /** Имя сущности для подписи («Ари») — из списка сущностей воркспейса. */
  entityName: string | null;
  isCharacter: boolean;
  /** Градиент-заглушка (когда url нет). */
  gradient: string;
  url: string | null;
  /** /gen blob was in DB but is gone from disk. */
  fileMissing: boolean;
  description: string | null;
  prompt: string | null;
  favorite: boolean;
  createdAt: string;
}

/** Сущность-подпись для тайла: имя + признак персонажа. */
export interface EntityNameHint {
  name: string;
  isCharacter: boolean;
}

export function albumItemOf(
  artifact: ArtifactDto,
  entities: Map<string, EntityNameHint>,
): AlbumItem {
  const hint = artifact.entityId ? entities.get(artifact.entityId) : undefined;
  return {
    id: artifact.id,
    kind: kindOf(artifact),
    title: artifact.title,
    entityId: artifact.entityId,
    entityName: hint?.name ?? null,
    isCharacter: hint?.isCharacter ?? false,
    gradient:
      metaOf(artifact, "gradient") ??
      GRADIENTS[gradientIndexOf(artifact.id) % GRADIENTS.length],
    url: artifact.fileMissing ? null : artifact.url,
    fileMissing: Boolean(artifact.fileMissing),
    description: artifact.description,
    prompt: artifact.prompt,
    favorite: artifact.favorite,
    createdAt: artifact.createdAt,
  };
}
