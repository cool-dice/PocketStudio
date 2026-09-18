/**
 * Typed fetch wrappers for the VibeFlow REST API (Next.js :3000).
 * Auth uses a hybrid scheme:
 *   1. `Authorization: Bearer <jwt>` from localStorage (primary — works inside
 *      sandbox preview iframes where third-party cookies are blocked);
 *   2. `vf_session` cookie (fallback for same-origin contexts, e.g. zip export).
 */

import type {
  AdminStats,
  AdminUserListItem,
  AuditLogEntry,
  Category,
  CheckpointResult,
  CommitDiff,
  CommitInfo,
  FileEntry,
  Message,
  Note,
  NoteProjectLink,
  Notification,
  Project,
  ProjectListItem,
  ProjectOrigin,
  Role,
  SearchResults,
  Task,
  Thread,
  ThreadListItem,
  ThreadMode,
  User,
} from "@/lib/types";
import type { StylePalette } from "@/lib/palette";
import type {
  ArtifactDto,
  ArtifactType,
  DashboardDto,
  DocumentDto,
  DocumentKind,
  DocumentSectionDto,
  EntityDto,
  EntityKind,
  FindingDto,
  FindingStatus,
  SectionRevisionDto,
  WorkspaceDto,
  WorkspaceKind,
} from "@/lib/workspace-types";

const TOKEN_STORAGE_KEY = "vf_token";

export function setAuthToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage unavailable (private mode) — cookie fallback still applies.
  }
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function getAuthToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: {
        "content-type": "application/json",
        ...authHeaders(),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Нет соединения с сервером", 0);
  }

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    // A stale/invalid Bearer token — drop it so the next login starts clean.
    // 401 from login/register themselves must not wipe a valid session.
    if (res.status === 401 && !/\/api\/auth\/(login|register)/.test(path)) {
      clearAuthToken();
    }
    const body = (data ?? {}) as {
      error?: string;
      fields?: Record<string, string>;
    };
    throw new ApiError(
      body.error ?? `Ошибка запроса (${res.status})`,
      res.status,
      body.fields,
    );
  }

  return data as T;
}

/**
 * Same as request() but for FormData bodies — the browser must set the
 * multipart boundary itself, so NO content-type header is passed.
 */
async function requestForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
  } catch {
    throw new ApiError("Нет соединения с сервером", 0);
  }

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) clearAuthToken();
    const body = (data ?? {}) as {
      error?: string;
      fields?: Record<string, string>;
    };
    throw new ApiError(
      body.error ?? `Ошибка запроса (${res.status})`,
      res.status,
      body.fields,
    );
  }

  return data as T;
}

export const api = {
  me(): Promise<User> {
    return request<{ user: User }>("/api/auth/me").then((r) => r.user);
  },

  login(email: string, password: string): Promise<User> {
    return request<{ user: User; token?: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).then((r) => {
      if (r.token) setAuthToken(r.token);
      return r.user;
    });
  },

  register(name: string, email: string, password: string): Promise<User> {
    return request<{ user: User; token?: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }).then((r) => {
      if (r.token) setAuthToken(r.token);
      return r.user;
    });
  },

  async logout(): Promise<void> {
    try {
      await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } finally {
      clearAuthToken();
    }
  },

  wsToken(): Promise<{ token: string; expiresIn: number }> {
    return request<{ token: string; expiresIn: number }>("/api/auth/ws-token");
  },

  listThreads(): Promise<ThreadListItem[]> {
    return request<{ threads: ThreadListItem[] }>("/api/threads").then(
      (r) => r.threads,
    );
  },

  createThread(data?: {
    title?: string;
    mode?: ThreadMode;
    projectId?: string;
  }): Promise<Thread> {
    return request<{ thread: Thread }>("/api/threads", {
      method: "POST",
      body: JSON.stringify(data ?? {}),
    }).then((r) => r.thread);
  },

  getThread(id: string): Promise<{ thread: Thread; messages: Message[] }> {
    return request<{ thread: Thread; messages: Message[] }>(
      `/api/threads/${encodeURIComponent(id)}`,
    );
  },

  getThreadTasks(id: string): Promise<{ tasks: Task[] }> {
    return request<{ tasks: Task[] }>(
      `/api/threads/${encodeURIComponent(id)}/tasks`,
    );
  },

  updateThread(
    id: string,
    patch: { title?: string; archived?: boolean; mode?: ThreadMode },
  ): Promise<Thread> {
    return request<{ thread: Thread }>(
      `/api/threads/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    ).then((r) => r.thread);
  },

  async deleteThread(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/threads/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  /* ── Notes & categories (Stage 1) ── */

  listNotes(params?: {
    categoryId?: string;
    favorite?: boolean;
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<{ notes: Note[]; total: number; hasMore: boolean }> {
    const qs = new URLSearchParams();
    if (params?.categoryId) qs.set("categoryId", params.categoryId);
    if (params?.favorite) qs.set("favorite", "1");
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const query = qs.toString();
    return request(`/api/notes${query ? `?${query}` : ""}`);
  },

  createNote(data: { text: string; categoryId?: string }): Promise<Note> {
    return request<{ note: Note }>("/api/notes", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.note);
  },

  getNote(id: string): Promise<Note> {
    return request<{ note: Note }>(`/api/notes/${encodeURIComponent(id)}`).then(
      (r) => r.note,
    );
  },

  updateNote(
    id: string,
    patch: { favorite?: boolean; categoryId?: string | null; rawText?: string },
  ): Promise<Note> {
    return request<{ note: Note }>(`/api/notes/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((r) => r.note);
  },

  async deleteNote(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/notes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /** Re-queue a note for LLM analysis (Stage 2). */
  reanalyzeNote(id: string): Promise<Note> {
    return request<{ note: Note }>(
      `/api/notes/${encodeURIComponent(id)}/analyze`,
      { method: "POST" },
    ).then((r) => r.note);
  },

  /** Voice capture: audio (WAV base64) → ASR → new note (Stage 2). */
  createVoiceNote(data: {
    audioBase64: string;
    mime: string;
  }): Promise<Note> {
    return request<{ note: Note }>("/api/notes/voice", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.note);
  },

  listCategories(): Promise<Category[]> {
    return request<{ categories: Category[] }>("/api/categories").then(
      (r) => r.categories,
    );
  },

  /* ── Projects & workspace files (Stage 3) ── */

  listProjects(): Promise<ProjectListItem[]> {
    return request<{ projects: ProjectListItem[] }>("/api/projects").then(
      (r) => r.projects,
    );
  },

  /** JSON create (template / github). The note is linked with kind 'context'. */
  createProject(data: {
    name: string;
    description?: string;
    origin: Extract<ProjectOrigin, "template" | "github">;
    remoteUrl?: string;
    noteId?: string;
  }): Promise<Project> {
    return request<{ project: Project }>("/api/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.project);
  },

  /** Multipart create (zip import, ≤20MB) from a prepared FormData. */
  createProjectFromZipRaw(form: FormData): Promise<Project> {
    return requestForm<{ project: Project }>("/api/projects", form).then(
      (r) => r.project,
    );
  },

  getProject(
    id: string,
  ): Promise<Project & { notes: { id: string; preview: string; status: string; linkKind: string }[] }> {
    return request<{
      project: Project & {
        notes: { id: string; preview: string; status: string; linkKind: string }[];
      };
    }>(`/api/projects/${encodeURIComponent(id)}`).then((r) => r.project);
  },

  updateProject(
    id: string,
    patch: { name?: string; description?: string },
  ): Promise<Project> {
    return request<{ project: Project }>(
      `/api/projects/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    ).then((r) => r.project);
  },

  async deleteProject(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/projects/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  getProjectTree(id: string): Promise<{
    tree: FileEntry[];
    truncated: boolean;
    dirty: boolean;
  }> {
    return request(`/api/projects/${encodeURIComponent(id)}/tree`);
  },

  getProjectFile(
    id: string,
    path: string,
  ): Promise<{ path: string; content: string; size: number }> {
    const qs = new URLSearchParams({ path });
    return request(
      `/api/projects/${encodeURIComponent(id)}/file?${qs.toString()}`,
    );
  },

  saveProjectFile(
    id: string,
    path: string,
    content: string,
  ): Promise<{ path: string; size: number; created: boolean }> {
    return request(`/api/projects/${encodeURIComponent(id)}/file`, {
      method: "PUT",
      body: JSON.stringify({ path, content }),
    });
  },

  listProjectCommits(id: string, limit = 50): Promise<CommitInfo[]> {
    return request<{ commits: CommitInfo[] }>(
      `/api/projects/${encodeURIComponent(id)}/commits?limit=${limit}`,
    ).then((r) => r.commits);
  },

  createProjectCheckpoint(
    id: string,
    message: string,
  ): Promise<CheckpointResult> {
    return request<{ checkpoint: CheckpointResult }>(
      `/api/projects/${encodeURIComponent(id)}/checkpoint`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      },
    ).then((r) => r.checkpoint);
  },

  /** Diff of one checkpoint (Stage 4). */
  getProjectDiff(id: string, commit: string): Promise<CommitDiff> {
    const qs = new URLSearchParams({ commit });
    return request<{ diff: CommitDiff }>(
      `/api/projects/${encodeURIComponent(id)}/diff?${qs.toString()}`,
    ).then((r) => r.diff);
  },

  /** URL for downloading the project as a zip (cookie-auth navigation). */
  projectExportUrl(id: string): string {
    return `/api/projects/${encodeURIComponent(id)}/export`;
  },

  /* ── Global search (Stage 4) ── */

  search(q: string): Promise<SearchResults> {
    const qs = new URLSearchParams({ q });
    return request<SearchResults>(`/api/search?${qs.toString()}`);
  },

  /* ── Note ↔ project links ── */

  listNoteLinks(id: string): Promise<NoteProjectLink[]> {
    return request<{ links: NoteProjectLink[] }>(
      `/api/notes/${encodeURIComponent(id)}/links`,
    ).then((r) => r.links);
  },

  linkNoteToProject(
    noteId: string,
    projectId: string,
    kind?: "reference" | "context" | "proposal",
  ): Promise<NoteProjectLink> {
    return request<{ link: NoteProjectLink }>(
      `/api/notes/${encodeURIComponent(noteId)}/links`,
      {
        method: "POST",
        body: JSON.stringify({ projectId, ...(kind ? { kind } : {}) }),
      },
    ).then((r) => r.link);
  },

  async unlinkNoteFromProject(noteId: string, projectId: string): Promise<void> {
    const qs = new URLSearchParams({ projectId });
    await request<{ ok: boolean }>(
      `/api/notes/${encodeURIComponent(noteId)}/links?${qs.toString()}`,
      { method: "DELETE" },
    );
  },

  /* ── Notifications (Stage 4b) ── */

  listNotifications(): Promise<{ notifications: Notification[]; unread: number }> {
    return request<{ notifications: Notification[]; unread: number }>(
      "/api/notifications",
    );
  },

  markNotificationRead(id: string, read = true): Promise<Notification> {
    return request<{ notification: Notification }>(
      `/api/notifications/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ read }),
      },
    ).then((r) => r.notification);
  },

  async markAllNotificationsRead(): Promise<void> {
    await request<{ ok: boolean }>("/api/notifications/read-all", {
      method: "POST",
    });
  },

  async clearNotifications(): Promise<void> {
    await request<{ ok: boolean }>("/api/notifications", {
      method: "DELETE",
    });
  },

  /* ── Admin panel (Stage 4b) ── */

  adminStats(): Promise<AdminStats> {
    return request<{ stats: AdminStats }>("/api/admin/stats").then(
      (r) => r.stats,
    );
  },

  adminUsers(params?: {
    q?: string;
    role?: "admin" | "client";
  }): Promise<AdminUserListItem[]> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.role) qs.set("role", params.role);
    const query = qs.toString();
    return request<{ users: AdminUserListItem[]}>(
      `/api/admin/users${query ? `?${query}` : ""}`,
    ).then((r) => r.users);
  },

  /** Role change — returns the plain user; the caller patches its local list. */
  adminUpdateUserRole(id: string, role: Role): Promise<{ id: string; role: Role }> {
    return request<{ id: string; role: Role }>(
      `/api/admin/users/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role }),
      },
    );
  },

  async adminDeleteUser(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/admin/users/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  adminAudit(limit = 50): Promise<AuditLogEntry[]> {
    return request<{ entries: AuditLogEntry[] }>(
      `/api/admin/audit?limit=${limit}`,
    ).then((r) => r.entries);
  },

  /* ── Workspaces / Documents / Entities / Artifacts / AI (Фаза A) ── */

  listWorkspaces(): Promise<WorkspaceDto[]> {
    return request<{ workspaces: WorkspaceDto[] }>("/api/workspaces").then(
      (r) => r.workspaces,
    );
  },

  createWorkspace(body: {
    type: WorkspaceKind;
    name: string;
    description?: string;
  }): Promise<WorkspaceDto> {
    return request<{ workspace: WorkspaceDto }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.workspace);
  },

  getWorkspace(id: string): Promise<WorkspaceDto> {
    return request<{ workspace: WorkspaceDto }>(
      `/api/workspaces/${encodeURIComponent(id)}`,
    ).then((r) => r.workspace);
  },

  updateWorkspace(
    id: string,
    body: Partial<Pick<WorkspaceDto, "name" | "description" | "stage" | "stageIndex" | "progress">>,
  ): Promise<WorkspaceDto> {
    return request<{ workspace: WorkspaceDto }>(
      `/api/workspaces/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.workspace);
  },

  async deleteWorkspace(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/workspaces/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /** ZIP-экспорт воркспейса (артефакты+документы+сущности) как Blob. */
  async exportWorkspaceZip(projectId: string): Promise<Blob> {
    let res: Response;
    try {
      res = await fetch(
        `/api/workspaces/${encodeURIComponent(projectId)}/export`,
        {
          credentials: "same-origin",
          headers: authHeaders(),
        },
      );
    } catch {
      throw new ApiError("Нет соединения с сервером", 0);
    }
    if (!res.ok) {
      if (res.status === 401) clearAuthToken();
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(
        body.error ?? `Ошибка запроса (${res.status})`,
        res.status,
      );
    }
    return res.blob();
  },

  listDocuments(projectId: string): Promise<DocumentDto[]> {
    return request<{ documents: DocumentDto[] }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/documents`,
    ).then((r) => r.documents);
  },

  createDocument(
    projectId: string,
    body: { title: string; description?: string; kind?: DocumentKind },
  ): Promise<DocumentDto> {
    return request<{ document: DocumentDto }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/documents`,
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.document);
  },

  getDocument(id: string): Promise<DocumentDto> {
    return request<{ document: DocumentDto }>(
      `/api/documents/${encodeURIComponent(id)}`,
    ).then((r) => r.document);
  },

  async updateDocument(
    id: string,
    body: { title?: string; description?: string | null },
  ): Promise<DocumentDto> {
    return request<{ document: DocumentDto }>(
      `/api/documents/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.document);
  },

  async deleteDocument(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  createSection(documentId: string, title: string): Promise<DocumentSectionDto> {
    return request<{ section: DocumentSectionDto }>(
      `/api/documents/${encodeURIComponent(documentId)}/sections`,
      { method: "POST", body: JSON.stringify({ title }) },
    ).then((r) => r.section);
  },

  updateSection(
    id: string,
    body: { title?: string; content?: string; status?: "draft" | "done" },
  ): Promise<DocumentSectionDto> {
    return request<{ section: DocumentSectionDto }>(
      `/api/sections/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.section);
  },

  async deleteSection(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/sections/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  /** История версий главы (PS-6): снапшоты перед перезаписями. */
  listSectionRevisions(sectionId: string): Promise<SectionRevisionDto[]> {
    return request<{ revisions: SectionRevisionDto[] }>(
      `/api/sections/${encodeURIComponent(sectionId)}/revisions`,
    ).then((r) => r.revisions);
  },

  /** Восстановить главу из версии (текущий текст тоже попадёт в историю). */
  restoreSectionRevision(
    sectionId: string,
    revisionId: string,
  ): Promise<DocumentSectionDto> {
    return request<{ section: DocumentSectionDto }>(
      `/api/sections/${encodeURIComponent(sectionId)}/revisions`,
      { method: "POST", body: JSON.stringify({ revisionId }) },
    ).then((r) => r.section);
  },

  listEntities(projectId: string): Promise<EntityDto[]> {
    return request<{ entities: EntityDto[] }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/entities`,
    ).then((r) => r.entities);
  },

  createEntity(
    projectId: string,
    body: Partial<EntityDto> & { kind: EntityKind; name: string },
  ): Promise<EntityDto> {
    return request<{ entity: EntityDto }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/entities`,
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.entity);
  },

  getEntity(id: string): Promise<EntityDto> {
    return request<{ entity: EntityDto }>(
      `/api/entities/${encodeURIComponent(id)}`,
    ).then((r) => r.entity);
  },

  updateEntity(
    id: string,
    body: Partial<
      Pick<
        EntityDto,
        "name" | "short" | "description" | "attributes" | "tags" | "portrait" | "favorite"
      >
    >,
  ): Promise<EntityDto> {
    return request<{ entity: EntityDto }>(
      `/api/entities/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.entity);
  },

  async deleteEntity(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/entities/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  listArtifacts(projectId: string, type?: string): Promise<ArtifactDto[]> {
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return request<{ artifacts: ArtifactDto[] }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/artifacts${qs}`,
    ).then((r) => r.artifacts);
  },

  /** Все артефакты пользователя (Библиотека); опц. фильтр типа/воркспейса. */
  listAllArtifacts(params?: {
    type?: string;
    projectId?: string;
  }): Promise<ArtifactDto[]> {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.projectId) qs.set("projectId", params.projectId);
    const query = qs.toString();
    return request<{ artifacts: ArtifactDto[] }>(
      `/api/artifacts${query ? `?${query}` : ""}`,
    ).then((r) => r.artifacts);
  },

  createArtifact(
    projectId: string,
    body: Partial<ArtifactDto> & { type: ArtifactType; title: string },
  ): Promise<ArtifactDto> {
    return request<{ artifact: ArtifactDto }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/artifacts`,
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.artifact);
  },

  updateArtifact(
    id: string,
    body: Partial<Pick<ArtifactDto, "title" | "description" | "stage" | "favorite">>,
  ): Promise<ArtifactDto> {
    return request<{ artifact: ArtifactDto }>(
      `/api/artifacts/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.artifact);
  },

  async deleteArtifact(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/artifacts/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  listFindings(projectId: string, status?: string): Promise<FindingDto[]> {
    const qs = new URLSearchParams({ projectId });
    if (status) qs.set("status", status);
    return request<{ findings: FindingDto[] }>(`/api/findings?${qs}`).then(
      (r) => r.findings,
    );
  },

  updateFinding(
    id: string,
    status: FindingStatus,
  ): Promise<FindingDto> {
    return request<{ finding: FindingDto }>(
      `/api/findings/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    ).then((r) => r.finding);
  },

  getDashboard(): Promise<DashboardDto> {
    return request<DashboardDto>("/api/dashboard");
  },

  aiGenerateImage(body: {
    projectId: string;
    prompt: string;
    title?: string;
    entityId?: string;
    stage?: string;
    size?: string;
  }): Promise<ArtifactDto> {
    return request<{ artifact: ArtifactDto }>("/api/ai/image", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.artifact);
  },

  aiTts(body: {
    projectId: string;
    text: string;
    title?: string;
    voice?: string;
    speed?: number;
  }): Promise<ArtifactDto> {
    return request<{ artifact: ArtifactDto }>("/api/ai/tts", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.artifact);
  },

  aiAnalyze(body: {
    documentId: string;
    scope?: "manuscript" | "spec" | "article";
  }): Promise<FindingDto[]> {
    return request<{ findings: FindingDto[] }>("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.findings);
  },

  aiDescribe(entityId: string): Promise<{ entityId: string; description: string }> {
    return request<{ entityId: string; description: string }>("/api/ai/describe", {
      method: "POST",
      body: JSON.stringify({ entityId }),
    });
  },

  /** Сгенерировать персистентный портрет сущности (PS-6): image в БД + артефакт. */
  generateEntityPortrait(
    entityId: string,
  ): Promise<{ entity: EntityDto; artifact: ArtifactDto }> {
    return request<{ entity: EntityDto; artifact: ArtifactDto }>(
      `/api/entities/${encodeURIComponent(entityId)}/portrait`,
      { method: "POST" },
    );
  },

  /** Убрать сгенерированный портрет сущности. */
  clearEntityPortrait(entityId: string): Promise<EntityDto> {
    return request<{ entity: EntityDto }>(
      `/api/entities/${encodeURIComponent(entityId)}/portrait`,
      { method: "DELETE" },
    ).then((r) => r.entity);
  },

  /** Собрать LLM-палитру стиля → артефакт (type file, stage style). */
  aiGeneratePalette(body: {
    projectId: string;
    brief?: string;
  }): Promise<{ artifact: ArtifactDto; palette: StylePalette }> {
    return request<{ artifact: ArtifactDto; palette: StylePalette }>(
      "/api/ai/palette",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  /** LLM-план монетизации воркспейса → документ kind="spec" с секциями. */
  aiMonetize(
    projectId: string,
    brief?: string,
  ): Promise<{ document: DocumentDto }> {
    return request<{ document: DocumentDto; plan: unknown }>(
      "/api/ai/monetize",
      {
        method: "POST",
        body: JSON.stringify({ projectId, ...(brief ? { brief } : {}) }),
      },
    );
  },
};
