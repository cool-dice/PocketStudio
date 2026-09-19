/**
 * Typed fetch wrappers for the PocketStudio REST API (Next.js :3000).
 * Auth uses a hybrid scheme:
 *   1. `Authorization: Bearer <jwt>` from localStorage (primary — works inside
 *      sandbox preview iframes where third-party cookies are blocked);
 *   2. `ps_session` cookie (legacy `vf_session` still accepted server-side).
 */

import type {
  AdminStats,
  AdminUserListItem,
  AiModelDto,
  AiProviderDto,
  AiToolDefaultDto,
  AuditLogPage,
  Category,
  Tag,
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
  UserAiSettingsDto,
} from "@/lib/types";
import type { StylePalette } from "@/lib/palette";
import type { DawProjectDto, DawState } from "@/lib/daw-model";
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
  McpServerDto,
  MentionSectionOption,
  SectionRevisionDto,
  WorkspaceDto,
  WorkspaceKind,
} from "@/lib/workspace-types";

const TOKEN_STORAGE_KEY = "ps_token";
const LEGACY_TOKEN_STORAGE_KEY = "vf_token";

export function setAuthToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable (private mode) — cookie fallback still applies.
  }
}

export function clearAuthToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function getAuthToken(): string | null {
  try {
    const current = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (current) return current;
    const legacy = window.localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY);
    if (legacy) {
      // Migrate once so DevTools and future requests show PocketStudio keys.
      window.localStorage.setItem(TOKEN_STORAGE_KEY, legacy);
      window.localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/** Blob → base64 (для загрузки бинарников в /upload).
 *  ВАЖНО: dataURL mime может содержать запятую («video/webm;codecs=vp9,opus»),
 *  поэтому режем по ПОСЛЕДНЕЙ запятой — иначе base64 получит мусорный префикс. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const marker = result.lastIndexOf(";base64,");
      const start = marker >= 0 ? marker + ";base64,".length : result.lastIndexOf(",") + 1;
      resolve(result.slice(start));
    };
    reader.readAsDataURL(blob);
  });
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

async function request<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = init?.timeoutMs;
  const rest = { ...(init ?? {}) } as RequestInit & { timeoutMs?: number };
  delete rest.timeoutMs;

  const controller = timeoutMs ? new AbortController() : null;
  const timer =
    timeoutMs && controller
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
  if (controller && rest.signal) {
    if (rest.signal.aborted) controller.abort();
    else {
      rest.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  let res: Response;
  try {
    res = await fetch(path, {
      credentials: "same-origin",
      ...rest,
      headers: {
        "content-type": "application/json",
        ...authHeaders(),
        ...rest.headers,
      },
      signal: controller?.signal ?? rest.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError("Провайдер не ответил вовремя", 504);
    }
    throw new ApiError("Нет соединения с сервером", 0);
  } finally {
    if (timer) clearTimeout(timer);
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

  updateMe(body: { name: string }): Promise<User> {
    return request<{ user: User; token?: string }>("/api/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => {
      if (r.token) setAuthToken(r.token);
      return r.user;
    });
  },

  changePassword(body: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<User> {
    return request<{ user: User; token?: string }>("/api/me/password", {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((r) => {
      if (r.token) setAuthToken(r.token);
      return r.user;
    });
  },

  authBootstrap(): Promise<{ firstUserBecomesAdmin: boolean }> {
    return request<{ firstUserBecomesAdmin: boolean }>("/api/auth/bootstrap");
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

  register(
    name: string,
    email: string,
    password: string,
    invite?: string,
  ): Promise<User> {
    return request<{ user: User; token?: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        password,
        ...(invite ? { invite } : {}),
      }),
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

  async logoutAll(): Promise<void> {
    await request<{ ok: boolean }>("/api/auth/logout-all", { method: "POST" });
    clearAuthToken();
  },

  wsToken(): Promise<{ token: string; expiresIn: number }> {
    return request<{ token: string; expiresIn: number }>("/api/auth/ws-token");
  },

  listThreads(opts?: { archived?: boolean }): Promise<ThreadListItem[]> {
    const qs = opts?.archived ? "?archived=1" : "";
    return request<{ threads: ThreadListItem[] }>(`/api/threads${qs}`).then(
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
    reminders?: boolean;
    due?: boolean;
    tagId?: string;
    q?: string;
    page?: number;
    limit?: number;
    projectId?: string;
  }): Promise<{ notes: Note[]; total: number; hasMore: boolean }> {
    const qs = new URLSearchParams();
    if (params?.categoryId) qs.set("categoryId", params.categoryId);
    if (params?.favorite) qs.set("favorite", "1");
    if (params?.reminders) qs.set("reminders", "1");
    if (params?.due) qs.set("due", "1");
    if (params?.tagId) qs.set("tagId", params.tagId);
    if (params?.q) qs.set("q", params.q);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.projectId) qs.set("projectId", params.projectId);
    const query = qs.toString();
    return request(`/api/notes${query ? `?${query}` : ""}`);
  },

  createNote(data: {
    text: string;
    /** Original ASR transcript; omit on typed notes. */
    transcription?: string;
    categoryId?: string;
    projectId?: string;
  }): Promise<Note> {
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
    patch: {
      favorite?: boolean;
      categoryId?: string | null;
      rawText?: string;
      remindAt?: string | null;
      tags?: string[];
    },
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

  /**
   * Voice capture: audio (WAV base64) → ASR transcript.
   * Does not create a note — the caller confirms, then POSTs /api/notes once.
   */
  transcribeVoice(data: {
    audioBase64: string;
    mime: string;
  }): Promise<string> {
    return request<{ text: string }>("/api/notes/voice", {
      method: "POST",
      body: JSON.stringify(data),
      // Slightly above server ASR timeout so the gateway 504 wins when it can.
      timeoutMs: 95_000,
    }).then((r) => r.text);
  },

  listCategories(): Promise<Category[]> {
    return request<{ categories: Category[] }>("/api/categories").then(
      (r) => r.categories,
    );
  },

  createCategory(data: {
    name: string;
    color?: string;
    icon?: string;
  }): Promise<Category> {
    return request<{ category: Category }>("/api/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.category);
  },

  updateCategory(
    id: string,
    patch: { name?: string; color?: string; icon?: string },
  ): Promise<Category> {
    return request<{ category: Category }>(
      `/api/categories/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    ).then((r) => r.category);
  },

  async deleteCategory(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/categories/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  listTags(): Promise<Tag[]> {
    return request<{ tags: Tag[] }>("/api/tags").then((r) => r.tags);
  },

  createTag(data: { name: string; color?: string }): Promise<Tag> {
    return request<{ tag: Tag }>("/api/tags", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.tag);
  },

  updateTag(
    id: string,
    patch: { name?: string; color?: string },
  ): Promise<Tag> {
    return request<{ tag: Tag }>(`/api/tags/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((r) => r.tag);
  },

  async deleteTag(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/tags/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  notesStats(): Promise<{
    days: { date: string; total: number; processed: number }[];
    dueReminders: number;
    total14d: number;
  }> {
    return request("/api/notes/stats");
  },

  fireDueReminders(): Promise<{
    fired: number;
    notes: {
      id: string;
      preview: string;
      notification?: Notification;
    }[];
  }> {
    return request("/api/notes/reminders/fire", { method: "POST" });
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

  deleteProjectFile(
    id: string,
    path: string,
  ): Promise<{ deleted: true; path: string }> {
    const qs = new URLSearchParams({ path });
    return request(
      `/api/projects/${encodeURIComponent(id)}/file?${qs.toString()}`,
      { method: "DELETE" },
    );
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

  /** Reset this project's working tree to a commit that belongs to it. */
  restoreProjectCheckpoint(
    id: string,
    commit: string,
  ): Promise<{
    commit: CommitInfo;
    discardedUncommitted: boolean;
  }> {
    return request<{
      restored: { commit: CommitInfo; discardedUncommitted: boolean };
    }>(`/api/projects/${encodeURIComponent(id)}/restore`, {
      method: "POST",
      body: JSON.stringify({ commit }),
    }).then((r) => r.restored);
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

  search(q: string, workspaceId?: string | null): Promise<SearchResults> {
    const qs = new URLSearchParams({ q });
    if (workspaceId) qs.set("workspaceId", workspaceId);
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
    return request<{ user: { id: string; role: Role } }>(
      `/api/admin/users/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ role }),
      },
    ).then((r) => {
      const user = r.user;
      if (
        !user?.id ||
        (user.role !== "admin" && user.role !== "client")
      ) {
        throw new ApiError("Не удалось изменить роль", 500);
      }
      return { id: user.id, role: user.role };
    });
  },

  async adminDeleteUser(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/admin/users/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  adminAudit(limit = 50, offset = 0): Promise<AuditLogPage> {
    const qs = new URLSearchParams();
    qs.set("limit", String(limit));
    if (offset > 0) qs.set("offset", String(offset));
    return request<AuditLogPage>(`/api/admin/audit?${qs.toString()}`);
  },

  adminAiProviders(): Promise<AiProviderDto[]> {
    return request<{ providers: AiProviderDto[] }>("/api/admin/ai/providers").then(
      (r) => r.providers,
    );
  },

  adminCreateAiProvider(body: Record<string, unknown>): Promise<AiProviderDto> {
    return request<{ provider: AiProviderDto }>("/api/admin/ai/providers", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.provider);
  },

  adminUpdateAiProvider(
    id: string,
    body: Record<string, unknown>,
  ): Promise<AiProviderDto> {
    return request<{ provider: AiProviderDto }>(
      `/api/admin/ai/providers/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.provider);
  },

  async adminDeleteAiProvider(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/admin/ai/providers/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  adminTestAiProvider(id: string): Promise<{ ok: true; detail: string }> {
    return request<{ ok: true; detail: string }>(
      `/api/admin/ai/providers/${encodeURIComponent(id)}/test`,
      { method: "POST", timeoutMs: 25_000 },
    );
  },

  adminCreateAiModel(
    providerId: string,
    body: Record<string, unknown>,
  ): Promise<AiModelDto> {
    return request<{ model: AiModelDto }>(
      `/api/admin/ai/providers/${encodeURIComponent(providerId)}/models`,
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.model);
  },

  adminUpdateAiModel(id: string, body: Record<string, unknown>): Promise<AiModelDto> {
    return request<{ model: AiModelDto }>(
      `/api/admin/ai/models/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.model);
  },

  async adminDeleteAiModel(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/admin/ai/models/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  adminAiDefaults(): Promise<AiToolDefaultDto[]> {
    return request<{ defaults: AiToolDefaultDto[] }>("/api/admin/ai/defaults").then(
      (r) => r.defaults,
    );
  },

  adminSetAiDefault(toolId: string, modelId: string): Promise<void> {
    return request<{ ok: boolean }>("/api/admin/ai/defaults", {
      method: "PUT",
      body: JSON.stringify({ toolId, modelId }),
    }).then(() => undefined);
  },

  userAiSettings(): Promise<UserAiSettingsDto> {
    return request<UserAiSettingsDto>("/api/settings/ai");
  },

  userCreateAiProvider(body: Record<string, unknown>): Promise<AiProviderDto> {
    return request<{ provider: AiProviderDto }>("/api/settings/ai/providers", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.provider);
  },

  userUpdateAiProvider(
    id: string,
    body: Record<string, unknown>,
  ): Promise<AiProviderDto> {
    return request<{ provider: AiProviderDto }>(
      `/api/settings/ai/providers/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.provider);
  },

  async userDeleteAiProvider(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/settings/ai/providers/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  userTestAiProvider(id: string): Promise<{ ok: true; detail: string }> {
    return request<{ ok: true; detail: string }>(
      `/api/settings/ai/providers/${encodeURIComponent(id)}/test`,
      { method: "POST", timeoutMs: 25_000 },
    );
  },

  userCreateAiModel(
    providerId: string,
    body: Record<string, unknown>,
  ): Promise<AiModelDto> {
    return request<{ model: AiModelDto }>(
      `/api/settings/ai/providers/${encodeURIComponent(providerId)}/models`,
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.model);
  },

  userUpdateAiModel(id: string, body: Record<string, unknown>): Promise<AiModelDto> {
    return request<{ model: AiModelDto }>(
      `/api/settings/ai/models/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.model);
  },

  async userDeleteAiModel(id: string): Promise<void> {
    await request<{ ok: boolean }>(
      `/api/settings/ai/models/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  userSetToolModel(toolId: string, modelId: string | null): Promise<void> {
    return request<{ ok: boolean }>(
      `/api/settings/ai/tools/${encodeURIComponent(toolId)}`,
      { method: "PUT", body: JSON.stringify({ modelId }) },
    ).then(() => undefined);
  },

  /* ── Workspaces / Documents / Entities / Artifacts / AI (Фаза A) ── */

  listWorkspaces(opts?: { archived?: boolean }): Promise<WorkspaceDto[]> {
    const qs = opts?.archived ? "?archived=1" : "";
    return request<{ workspaces: WorkspaceDto[] }>(`/api/workspaces${qs}`).then(
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
    body: Partial<
      Pick<
        WorkspaceDto,
        "name" | "description" | "stage" | "stageIndex" | "progress" | "favorite" | "archived"
      >
    >,
  ): Promise<WorkspaceDto> {
    return request<{ workspace: WorkspaceDto }>(
      `/api/workspaces/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.workspace);
  },

  duplicateWorkspace(id: string): Promise<WorkspaceDto> {
    return request<{ workspace: WorkspaceDto }>(
      `/api/workspaces/${encodeURIComponent(id)}/duplicate`,
      { method: "POST" },
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

  /* ── MCP-интеграции (Фаза D) ── */

  listMcpServers(): Promise<McpServerDto[]> {
    return request<{ servers: McpServerDto[] }>("/api/mcp").then(
      (r) => r.servers,
    );
  },

  createMcpServer(body: {
    name: string;
    description?: string;
    transport: "stdio" | "sse";
    config: Record<string, unknown>;
  }): Promise<McpServerDto> {
    return request<{ server: McpServerDto }>("/api/mcp", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.server);
  },

  updateMcpServer(
    id: string,
    body: {
      enabled?: boolean;
      name?: string;
      description?: string;
      config?: Record<string, unknown>;
    },
  ): Promise<McpServerDto> {
    return request<{ server: McpServerDto }>(
      `/api/mcp/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.server);
  },

  async deleteMcpServer(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/mcp/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  getMcpConfig(): Promise<{ config: string; count: number }> {
    return request<{ config: string; count: number }>("/api/mcp/config");
  },

  /** Dockerfile-генератор: пишет файлы в проект. Образ не публикуется. */
  generateDockerfile(
    projectId: string,
    overwrite = false,
  ): Promise<{
    kind: string;
    dockerfile: string;
    dockerignore: string;
    workspace: { id: string; name: string };
    published: false;
    imageTag: null;
    status: string;
    empty: boolean;
    hint: string;
  }> {
    return request(`/api/workspaces/${encodeURIComponent(projectId)}/dockerfile`, {
      method: "POST",
      body: JSON.stringify({ overwrite }),
    });
  },

  /* ── DAW-студия (Фаза C) ── */

  getDawState(projectId: string): Promise<DawProjectDto> {
    return request<{ project: DawProjectDto }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/daw`,
    ).then((r) => r.project);
  },

  saveDawState(projectId: string, state: DawState): Promise<DawProjectDto> {
    return request<{ project: DawProjectDto }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/daw`,
      { method: "PUT", body: JSON.stringify(state) },
    ).then((r) => r.project);
  },

  /** Загрузка бинарника (микс/сэмпл/фильм) → файл → артефакт воркспейса. */
  async uploadArtifact(
    projectId: string,
    input: {
      blob: Blob;
      type: "audio" | "video" | "image" | "file";
      title: string;
      description?: string;
      stage?: string;
      meta?: Record<string, unknown>;
    },
  ): Promise<ArtifactDto> {
    const dataBase64 = await blobToBase64(input.blob);
    const artifact = await request<{ artifact: ArtifactDto }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/upload`,
      {
        method: "POST",
        body: JSON.stringify({
          dataBase64,
          mime: input.blob.type || "application/octet-stream",
          type: input.type,
          title: input.title,
          description: input.description,
          stage: input.stage,
          meta: input.meta,
        }),
      },
    ).then((r) => r.artifact);
    return artifact;
  },

  listDocuments(projectId: string): Promise<DocumentDto[]> {
    return request<{ documents: DocumentDto[] }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/documents`,
    ).then((r) => r.documents);
  },

  listWorkspaceSections(projectId: string): Promise<MentionSectionOption[]> {
    return request<{ sections: MentionSectionOption[] }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/sections`,
    ).then((r) => r.sections);
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
        | "name"
        | "short"
        | "description"
        | "attributes"
        | "tags"
        | "related"
        | "portrait"
        | "favorite"
        | "refs"
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

  listSectionMentions(sectionId: string): Promise<{
    linked: { id: string; name: string; kind: string }[];
    foundInText: { id: string; name: string; kind: string }[];
  }> {
    return request(
      `/api/sections/${encodeURIComponent(sectionId)}/mentions`,
    );
  },

  addSectionMention(sectionId: string, entityId: string): Promise<EntityDto> {
    return request<{ entity: EntityDto }>(
      `/api/sections/${encodeURIComponent(sectionId)}/mentions`,
      { method: "POST", body: JSON.stringify({ entityId }) },
    ).then((r) => r.entity);
  },

  async removeSectionMention(sectionId: string, entityId: string): Promise<EntityDto> {
    return request<{ entity: EntityDto }>(
      `/api/sections/${encodeURIComponent(sectionId)}/mentions/${encodeURIComponent(entityId)}`,
      { method: "DELETE" },
    ).then((r) => r.entity);
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

  addAlbumFromLibrary(projectId: string, sourceId: string): Promise<ArtifactDto> {
    return request<{ artifact: ArtifactDto }>(
      `/api/workspaces/${encodeURIComponent(projectId)}/artifacts`,
      { method: "POST", body: JSON.stringify({ sourceId }) },
    ).then((r) => r.artifact);
  },

  aiGenerateImage(body: {
    projectId: string;
    prompt: string;
    title?: string;
    entityId?: string;
    stage?: string;
    size?: string;
    albumKind?: "portrait" | "illustration" | "concept";
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

  /** ИИ: переписать / продолжить / править главу по инструкции. */
  aiRewriteSection(body: {
    sectionId: string;
    action: "write" | "rewrite" | "continue" | "custom";
    instruction?: string;
  }): Promise<DocumentSectionDto> {
    return request<{ section: DocumentSectionDto }>("/api/ai/section", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((r) => r.section);
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

  listSkills(): Promise<{
    skills: import("@/lib/skill-shapes").SkillDto[];
    store: import("@/lib/skill-shapes").StoreSkillDto[];
  }> {
    return request("/api/skills");
  },

  createSkill(body: {
    name: string;
    description?: string;
    skillMd: string;
    triggers?: string[];
    icon?: string;
  }): Promise<import("@/lib/skill-shapes").SkillDto> {
    return request<{ skill: import("@/lib/skill-shapes").SkillDto }>(
      "/api/skills",
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.skill);
  },

  updateSkill(
    id: string,
    body: { enabled?: boolean; name?: string; skillMd?: string; triggers?: string[] },
  ): Promise<import("@/lib/skill-shapes").SkillDto> {
    return request<{ skill: import("@/lib/skill-shapes").SkillDto }>(
      `/api/skills/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(body) },
    ).then((r) => r.skill);
  },

  duplicateSkill(id: string): Promise<import("@/lib/skill-shapes").SkillDto> {
    return request<{ skill: import("@/lib/skill-shapes").SkillDto }>(
      `/api/skills/${encodeURIComponent(id)}`,
      { method: "POST" },
    ).then((r) => r.skill);
  },

  async deleteSkill(id: string): Promise<void> {
    await request(`/api/skills/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  importSkill(body: {
    catalogKey?: string;
    url?: string;
    skillMd?: string;
    name?: string;
  }): Promise<import("@/lib/skill-shapes").SkillDto> {
    return request<{ skill: import("@/lib/skill-shapes").SkillDto }>(
      "/api/skills/import",
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.skill);
  },

  listEnabledSkills(): Promise<{
    skills: import("@/lib/skill-shapes").SkillDto[];
    promptBlock: string;
  }> {
    return request("/api/skills/enabled");
  },

  getDesign(
    workspaceId: string,
    mode: "raster" | "layout",
  ): Promise<{
    design: {
      id: string;
      mode: string;
      payload: unknown;
      previewUrl: string | null;
      title: string;
    };
  }> {
    return request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/design?mode=${mode}`,
    );
  },

  saveDesign(
    workspaceId: string,
    body: {
      mode: "raster" | "layout";
      payload: unknown;
      previewUrl?: string | null;
      title?: string;
    },
  ): Promise<unknown> {
    return request(`/api/workspaces/${encodeURIComponent(workspaceId)}/design`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  getTimeline(workspaceId: string): Promise<{
    timeline: import("@/lib/nle-model").NleTimeline;
    fps: number;
  }> {
    return request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/timeline`,
    );
  },

  saveTimeline(
    workspaceId: string,
    body: { timeline: import("@/lib/nle-model").NleTimeline; fps?: number },
  ): Promise<unknown> {
    return request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/timeline`,
      { method: "PUT", body: JSON.stringify(body) },
    );
  },

  listOffers(projectId?: string): Promise<
    {
      id: string;
      projectId: string;
      title: string;
      description: string | null;
      priceCents: number;
      currency: string;
      status: string;
      paymentMode: string;
      paidAt: string | null;
      createdAt: string;
    }[]
  > {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return request<{ offers: Array<{
      id: string;
      projectId: string;
      title: string;
      description: string | null;
      priceCents: number;
      currency: string;
      status: string;
      paymentMode: string;
      paidAt: string | null;
      createdAt: string;
    }> }>(`/api/offers${qs}`).then((r) => r.offers);
  },

  createOffer(body: {
    projectId: string;
    title: string;
    description?: string;
    priceCents: number;
    paymentMode?: "simulated" | "live";
  }): Promise<{ id: string; status: string; title: string; priceCents: number; currency: string; paymentMode: string; paidAt: string | null }> {
    return request<{ offer: { id: string; status: string; title: string; priceCents: number; currency: string; paymentMode: string; paidAt: string | null } }>(
      "/api/offers",
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.offer);
  },

  checkoutOffer(id: string): Promise<unknown> {
    return request(`/api/offers/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ checkout: true }),
    });
  },

  peekInvite(token: string): Promise<{
    status: "ok" | "used" | "expired" | "invalid";
    role?: "admin" | "client";
    email?: string;
  }> {
    return request(`/api/invites/${encodeURIComponent(token)}`);
  },

  listPayouts(): Promise<{
    payouts: Array<{
      id: string;
      amountCents: number;
      currency: string;
      status: string;
      note: string | null;
      createdAt: string;
    }>;
    totalPendingCents: number;
    totalPaidCents: number;
  }> {
    return request("/api/payouts");
  },

  paymentsStatus(): Promise<{
    defaultMode: string;
    liveKeyConfigured: boolean;
    modes: { id: string; label: string; hint: string }[];
  }> {
    return request("/api/payments/status");
  },

  dockerBuild(workspaceId: string): Promise<{
    status: string;
    log: string;
    imageTag: string | null;
    published: false;
  }> {
    return request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/docker-build`,
      { method: "POST" },
    );
  },

  compileFilmFfmpeg(
    workspaceId: string,
    body?: { clips?: { imageUrl?: string | null; durationSec?: number }[] },
  ): Promise<{
    status: string;
    log: string;
    url: string | null;
  }> {
    return request(
      `/api/workspaces/${encodeURIComponent(workspaceId)}/compile-film`,
      {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      },
    );
  },

  projectPreview(projectId: string): Promise<{
    kind: string;
    running?: boolean;
    file: string | null;
    src: string | null;
    files?: string[];
    hint?: string;
  }> {
    return request(`/api/projects/${encodeURIComponent(projectId)}/preview`);
  },

  getOnboarding(): Promise<{ onboardingDone: boolean }> {
    return request("/api/me/onboarding");
  },

  setOnboardingDone(done: boolean): Promise<void> {
    return request("/api/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ onboardingDone: done }),
    }).then(() => undefined);
  },

  registerWithInvite(
    name: string,
    email: string,
    password: string,
    invite?: string,
  ): Promise<User> {
    return this.register(name, email, password, invite);
  },

  listAdminOffers(): Promise<
    Array<{
      id: string;
      title: string;
      priceCents: number;
      currency: string;
      status: string;
      paymentMode: string;
      userEmail: string;
      userName: string;
      workspaceName: string;
    }>
  > {
    return request<{ offers: Array<{
      id: string;
      title: string;
      priceCents: number;
      currency: string;
      status: string;
      paymentMode: string;
      userEmail: string;
      userName: string;
      workspaceName: string;
    }> }>("/api/admin/offers").then((r) => r.offers);
  },

  markOfferPaid(id: string): Promise<unknown> {
    return request(`/api/admin/offers/${encodeURIComponent(id)}/paid`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  listAdminPayouts(): Promise<
    Array<{
      id: string;
      amountCents: number;
      currency: string;
      status: string;
      note: string | null;
      userEmail: string;
      userName: string;
      createdAt: string;
    }>
  > {
    return request<{
      payouts: Array<{
        id: string;
        amountCents: number;
        currency: string;
        status: string;
        note: string | null;
        userEmail: string;
        userName: string;
        createdAt: string;
      }>;
    }>("/api/admin/payouts").then((r) => r.payouts);
  },

  patchPayout(
    id: string,
    status: "paid" | "failed",
  ): Promise<{ payout: { id: string; status: string; amountCents: number } }> {
    return request("/api/payouts", {
      method: "PATCH",
      body: JSON.stringify({ id, status }),
    });
  },

  listInvites(): Promise<
    Array<{
      id: string;
      email: string;
      role: string;
      token: string;
      usedAt: string | null;
      expiresAt: string | null;
      createdAt: string;
    }>
  > {
    return request<{ invites: Array<{
      id: string;
      email: string;
      role: string;
      token: string;
      usedAt: string | null;
      expiresAt: string | null;
      createdAt: string;
    }> }>("/api/admin/invites").then((r) => r.invites);
  },

  createInvite(email: string, role: "client" | "admin" = "client"): Promise<{
    token: string;
    email: string;
    role: string;
  }> {
    return request<{ invite: { token: string; email: string; role: string } }>(
      "/api/admin/invites",
      { method: "POST", body: JSON.stringify({ email, role }) },
    ).then((r) => r.invite);
  },

  reindexRag(body: { projectId?: string; all?: boolean } = {}): Promise<{
    ok: true;
    message?: string;
    report?: Record<string, number>;
  }> {
    return request("/api/rag/reindex", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};

