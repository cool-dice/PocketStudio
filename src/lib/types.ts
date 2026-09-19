/**
 * PocketStudio shared client types — mirror the REST/WS API shapes
 * (see worklog Task 1 contracts, 2-a auth routes, 2-b agent-service).
 */

export type Role = "admin" | "client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  onboardingDone?: boolean;
}

export type ThreadMode = "ask" | "plan" | "act" | "review";

export interface Thread {
  id: string;
  title: string;
  mode: ThreadMode;
  archived: boolean;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThreadLastMessage {
  content: string;
  role: "user" | "assistant";
  createdAt: string;
}

export interface ThreadListItem extends Thread {
  lastMessage: ThreadLastMessage | null;
}

export type MessageRole = "user" | "assistant" | "tool";

export interface Message {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  /** Tool rows (role "tool"): tool name (present in REST history). */
  toolName?: string | null;
  /** Tool arguments as JSON string (present in live WS events). */
  toolArgs?: string | null;
  /** Tool result as JSON string (present in live WS events). */
  toolResult?: string | null;
}

/** Client-side message with optimistic/streaming flags. */
export interface ChatMessage extends Message {
  /** Optimistic user message not yet confirmed by the server. */
  pending?: boolean;
  /** Assistant message currently being streamed. */
  streaming?: boolean;
  /** Tool call is currently executing (agent still working). */
  toolPending?: boolean;
}

/* ── Notes & categories (Stage 1 REST contract) ── */

export type NoteStatus = "pending" | "processing" | "processed" | "error";

/** Category subset embedded in note responses. */
export interface NoteCategoryRef {
  id: string;
  name: string;
  color: string;
  icon: string;
}

/** 4-block LLM analysis of a note (null until status === "processed"). */
export interface NoteAnalysis {
  positive: string | null;
  negative: string | null;
  final: string | null;
  recommendations: string[] | null;
  analyzedAt: string | null;
}

export interface Note extends NoteAnalysis {
  id: string;
  rawText: string | null;
  status: NoteStatus;
  favorite: boolean;
  createdAt: string;
  updatedAt?: string;
  transcription?: string | null;
  errorMessage?: string | null;
  category: NoteCategoryRef | null;
  tags?: { id: string; name: string; color: string }[];
  remindAt?: string | null;
}

export interface Category extends NoteCategoryRef {
  noteCount: number;
}

/* ── WS payloads (mini-services/agent-service contract) ── */

export interface WsToolStartPayload {
  threadId: string;
  messageId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface WsToolEndPayload {
  threadId: string;
  messageId: string;
  tool: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface WsMessageUserPayload {
  message: Message;
}

export interface WsAgentThinkingPayload {
  threadId: string;
}

export interface WsMessageStartPayload {
  threadId: string;
  messageId: string;
}

export interface WsMessageDeltaPayload {
  threadId: string;
  messageId: string;
  delta: string;
}

export interface WsMessageEndPayload {
  threadId: string;
  message: Message;
}

export interface WsThreadUpdatedPayload {
  thread: {
    id: string;
    title: string;
    updatedAt: string;
  };
}

export interface WsErrorPayload {
  message: string;
}

/* ── Plan tasks & orchestrator phases (Stage 4c) ── */

/** Plan task of a thread (planner / plan-mode generated checklist). */
export interface Task {
  id: string;
  order: number;
  text: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TurnPhase = "plan" | "act" | "review" | "idle";

export interface WsTasksUpdatedPayload {
  threadId: string;
  tasks: Task[];
}

export interface WsTurnPhasePayload {
  threadId: string;
  phase: TurnPhase;
  label: string | null;
}

/* ── Note analysis pipeline events (Stage 2, worklog Task 2-ctr) ── */

export interface WsNoteAnalyzingPayload {
  noteId: string;
}

export interface WsNoteAnalyzedPayload {
  note: Note;
}

/* ── Projects, workspace files & git (Stage 3 REST contract) ── */

export type ProjectOrigin = "template" | "github" | "zip";

export interface ProjectStats {
  filesCount: number;
  commitsCount: number;
  lastCommit: CommitInfo | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  origin: ProjectOrigin;
  remoteUrl: string | null;
  createdAt: string;
  updatedAt: string;
  stats?: ProjectStats;
}

/** Project row as returned by GET /api/projects (adds list counters). */
export interface ProjectListItem extends Project {
  threadsCount: number;
  notesLinked: number;
  stats: ProjectStats;
}

export interface FileEntry {
  /** Relative POSIX path without a leading ./ */
  path: string;
  type: "file" | "dir";
  /** Bytes for files, 0 for dirs. */
  size: number;
}

export interface CommitInfo {
  hash: string;
  short: string;
  message: string;
  author: string;
  /** ISO date. */
  date: string;
}

export interface CheckpointResult {
  noop: boolean;
  commit: CommitInfo | null;
  filesChanged: number;
}

/** Note ↔ project link as returned by GET /api/notes/[id]/links. */
export interface NoteProjectLink {
  id: string;
  kind: "reference" | "context" | "proposal";
  project: { id: string; name: string; origin: ProjectOrigin };
}

/* ── Project WS events (Stage 3, agent-service → user room) ── */

export interface WsProjectCreatedPayload {
  project: { id: string; name: string; origin: ProjectOrigin };
}

export interface WsProjectUpdatedPayload {
  projectId: string;
  reason: "files" | "checkpoint" | "workspace";
}

/* ── Checkpoint diff (Stage 4) ── */

export type DiffFileStatus = "added" | "modified" | "deleted";

export interface CommitDiffFile {
  path: string;
  status: DiffFileStatus;
  original: string;
  modified: string;
  truncated: boolean;
  skipped: boolean;
}

export interface CommitDiff {
  commit: CommitInfo;
  files: CommitDiffFile[];
  skippedCount: number;
}

/* ── Notifications (Stage 4b) ── */

export type NotificationType =
  | "analysis_ready"
  | "project_created"
  | "checkpoint"
  | "system";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entityId: string | null;
  read: boolean;
  createdAt: string;
}

export interface WsNotificationNewPayload {
  notification: Notification;
}

/* ── Admin panel (Stage 4b) ── */

export interface AdminStats {
  users: number;
  admins: number;
  newUsers7d: number;
  notes: number;
  notesProcessed: number;
  notesError: number;
  categories: number;
  projects: number;
  threads: number;
  messages: number;
  notifications: number;
  activity: {
    date: string; // YYYY-MM-DD
    notes: number;
    threads: number;
    projects: number;
  }[];
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  lastActivity: string | null;
  counts: { notes: number; threads: number; projects: number };
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
}

/* ── AI providers (admin + user settings) ── */

export type AiProviderKind = "openai_compatible" | "anthropic_compatible";

export interface AiModelDto {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  capChat: boolean;
  capImage: boolean;
  capTts: boolean;
  capAsr: boolean;
  capEmbeddings: boolean;
  enabled: boolean;
}

export interface AiProviderDto {
  id: string;
  kind: AiProviderKind | string;
  name: string;
  baseUrl: string;
  apiKeyMasked: string;
  enabled: boolean;
  visibleToUsers: boolean;
  markupPercent: number | null;
  markupMultiplier: number | null;
  extraHeaders: string | null;
  isPlatform: boolean;
  createdAt: string;
  updatedAt: string;
  models: AiModelDto[];
}

export interface AiToolDefaultDto {
  toolId: string;
  label: string;
  description?: string;
  capability: string;
  modelId: string | null;
  model: {
    id: string;
    modelId: string;
    displayName: string;
    providerId: string;
    providerName: string;
  } | null;
}

export interface UserAiToolChoice {
  id: string;
  label: string;
  description: string;
  capability: string;
  modelId: string | null;
  useStudioDefault: boolean;
}

export interface UserAiSettingsDto {
  tools: UserAiToolChoice[];
  platformProviders: AiProviderDto[];
  ownProviders: AiProviderDto[];
}

/* ── Global search (Stage 4) ── */

export interface SearchThreadHit {
  id: string;
  title: string;
  mode: ThreadMode;
  projectId: string | null;
  updatedAt: string;
  preview: string | null;
}

export interface SearchNoteHit {
  id: string;
  preview: string;
  status: NoteStatus;
  favorite: boolean;
  createdAt: string;
  category: { id: string; name: string } | null;
}

export interface SearchProjectHit {
  id: string;
  name: string;
  description: string | null;
  origin: ProjectOrigin;
  updatedAt: string;
}

export interface SearchResults {
  threads: SearchThreadHit[];
  notes: SearchNoteHit[];
  projects: SearchProjectHit[];
  total: number;
}

export const MODE_LABELS: Record<ThreadMode, string> = {
  ask: "Спросить",
  plan: "План",
  act: "Действовать",
  review: "Ревью",
};

/** Short RU description for the chat mode selector. */
export const MODE_DESCRIPTIONS: Record<ThreadMode, string> = {
  ask: "Вопросы и ответы, без изменений",
  plan: "План работ перед кодом",
  act: "Полный доступ: создаёт и пишет файлы",
  review: "Ревью кода и предложения правок",
};

export const MAX_MESSAGE_LENGTH = 20000;
export const MAX_NOTE_LENGTH = 5000;
