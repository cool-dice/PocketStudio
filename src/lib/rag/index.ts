export type { RagHit, RagScope, RagScopeKind, RetrieveResult, RagSourceType } from "./types";
export { RAG_SOURCE_TYPES, UNCONFIGURED_EMBEDDINGS_MESSAGE, RAG_KEYWORD_NOTICE } from "./types";
export {
  chunkMatchesScope,
  filterChunksByScope,
  ragScopeFromThread,
  ragScopeLabel,
  resolveRetrieveScope,
} from "./scope";
export { retrieve } from "./retrieve";
export { indexDocument, removeSource, removeFileChunks } from "./indexer";
export {
  looksLikeCanonQuestion,
  formatPrefetchBlock,
  formatPrefetchHint,
} from "./prefetch";
export {
  scheduleIndex,
  scheduleIndexNote,
  scheduleIndexSection,
  scheduleIndexEntity,
  scheduleIndexArtifact,
  scheduleIndexSkill,
  scheduleIndexFinding,
  scheduleIndexFile,
  scheduleRemove,
  indexFileContent,
  indexSectionById,
  indexEntityById,
  flushRagQueue,
} from "./hooks";
export {
  reindexUserData,
  reindexAllUsers,
  purgeStaleChunks,
  purgeMissingFileChunks,
  reindexProjectFiles,
  scheduleReindexProjectFiles,
} from "./reindex";
export { shouldSkipPath } from "./skip";
export { embeddingsConfigured } from "./embed";
