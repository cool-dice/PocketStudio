/**
 * RAG types — shared by Next API routes and bun agent-service.
 * No "@/..." aliases.
 */

export const RAG_SOURCE_TYPES = [
  "note",
  "section",
  "entity",
  "artifact",
  "file",
  "thread",
  "skill",
  "finding",
] as const;

export type RagSourceType = (typeof RAG_SOURCE_TYPES)[number];

export type RagScopeKind = "global" | "workspace";

export interface RagScope {
  kind: RagScopeKind;
  userId: string;
  /** Set iff kind === "workspace". */
  projectId: string | null;
}

export interface RagChunkRow {
  id: string;
  userId: string;
  projectId: string | null;
  sourceType: string;
  sourceId: string;
  path: string | null;
  ordinal: number;
  content: string;
  tokenCount: number;
  contentHash: string;
  projectName?: string | null;
  score?: number;
}

export interface RagHit {
  kind: RagSourceType | string;
  id: string;
  sourceId: string;
  title: string;
  excerpt: string;
  workspaceId: string | null;
  workspaceName: string | null;
  path: string | null;
  score: number;
}

export interface RetrieveResult {
  query: string;
  scope: RagScopeKind;
  mode: "vector" | "keyword";
  notice: string | null;
  hits: RagHit[];
}

export const RAG_EMBEDDING_DIM = 1536;

export const UNCONFIGURED_EMBEDDINGS_MESSAGE =
  "Модель эмбеддингов не настроена. Админ → Модели ИИ → инструмент «Эмбеддинги».";

export const EMBEDDING_DIM_MISMATCH_MESSAGE =
  `Модель эмбеддингов вернула векторы не той длины. Студия хранит ${RAG_EMBEDDING_DIM} измерений (например text-embedding-3-small). Смените модель в Админ → Модели ИИ.`;

/** Search/prefetch without a configured embeddings model — never invent vectors. */
export const RAG_KEYWORD_NOTICE = "поиск без эмбеддингов";
