/**
 * Workspace DTO types (Фаза A) — форма данных, которую отдают REST API
 * воркспейсов/документов/сущностей/артефактов и потребляет фронт.
 */

export type WorkspaceKind = "film" | "book" | "music" | "app" | "universal";

export interface WorkspaceCounts {
  notes: number;
  documents: number;
  images: number;
  audio: number;
  video: number;
  files: number;
}

export interface WorkspaceDto {
  id: string;
  type: WorkspaceKind;
  name: string;
  description: string | null;
  origin: string;
  stage: string | null;
  stageIndex: number | null;
  progress: number;
  counts: WorkspaceCounts;
  createdAt: string;
  updatedAt: string;
}

export type DocumentKind = "manuscript" | "spec" | "article" | "script";

export interface DocumentSectionDto {
  id: string;
  documentId: string;
  title: string;
  order: number;
  content: string;
  status: "draft" | "done";
  wordsCount: number;
  updatedAt: string;
}

/** Снапшот главы из истории версий (PS-6). */
export interface SectionRevisionDto {
  id: string;
  source: "manual" | "ai" | "restore";
  size: number;
  createdAt: string;
  preview: string;
}

export interface DocumentDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  kind: DocumentKind;
  wordsCount: number;
  updatedAt: string;
  sections?: DocumentSectionDto[];
  sectionsCount?: number;
}

export type EntityDomain = "narrative" | "product";

export type EntityKind =
  | "character"
  | "location"
  | "event"
  | "item"
  | "faction"
  | "rule"
  | "user"
  | "role"
  | "requirement"
  | "module"
  | "integration";

export interface EntityAttribute {
  label: string;
  value: string;
}

export interface EntityRefs {
  kind: "chapter" | "section";
  items: string[];
}

export interface EntityPortrait {
  gradient: string;
  initials: string;
}

export interface EntityDto {
  id: string;
  projectId: string;
  setId: string;
  setName: string;
  domain: EntityDomain;
  kind: EntityKind;
  name: string;
  short: string | null;
  description: string;
  attributes: EntityAttribute[];
  tags: string[];
  refs: EntityRefs;
  portrait: EntityPortrait | null;
  /** URL персистентного сгенерированного портрета/иллюстрации (PS-6). */
  image: string | null;
  favorite: boolean;
  related?: string[];
  updatedAt: string;
}

export type ArtifactType =
  | "note"
  | "document"
  | "portrait"
  | "image"
  | "track"
  | "scene"
  | "app"
  | "deploy"
  | "audio"
  | "video"
  | "file";

export interface ArtifactDto {
  id: string;
  projectId: string;
  type: ArtifactType;
  title: string;
  description: string | null;
  url: string | null;
  prompt: string | null;
  entityId: string | null;
  stage: string | null;
  meta: Record<string, unknown> | null;
  favorite: boolean;
  createdAt: string;
}

export type FindingType = "contradiction" | "omission" | "inconsistency";
export type FindingSeverity = "info" | "warning" | "critical";
export type FindingStatus = "open" | "fixed" | "dismissed";

export interface FindingDto {
  id: string;
  projectId: string;
  documentId: string | null;
  scope: string;
  type: FindingType;
  severity: FindingSeverity;
  title: string;
  quote: string | null;
  advice: string | null;
  sourceRef: string | null;
  status: FindingStatus;
  createdAt: string;
}

export interface DashboardActivityItem {
  id: string;
  workspaceId: string;
  text: string;
  time: string;
  type: ArtifactType | "workspace";
}

export interface DashboardDto {
  stats: {
    workspaces: number;
    artifacts: number;
    notesWeek: number;
    activeStages: number;
  };
  activity: DashboardActivityItem[];
}

// ─────────────────────────── MCP integrations (Фаза D) ───────────────────────────

export type McpCategory = "dev" | "content" | "data";
export type McpTransport = "builtin" | "stdio" | "sse";

export interface McpServerDto {
  id: string;
  catalogKey: string | null;
  name: string;
  description: string;
  category: McpCategory;
  transport: McpTransport;
  adapter: string | null;
  external: boolean;
  toolsCount: number;
  enabled: boolean;
  own: boolean;
  config: Record<string, unknown>;
  createdAt: string;
}
