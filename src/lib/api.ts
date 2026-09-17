/**
 * Typed fetch wrappers for the VibeFlow REST API (Next.js :3000).
 * All requests use relative paths and the same-origin session cookie.
 */

import type {
  Category,
  Message,
  Note,
  Thread,
  ThreadListItem,
  ThreadMode,
  User,
} from "@/lib/types";

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
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError("Нет соединения с сервером", 0);
  }

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
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
    return request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }).then((r) => r.user);
  },

  register(name: string, email: string, password: string): Promise<User> {
    return request<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }).then((r) => r.user);
  },

  async logout(): Promise<void> {
    await request<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
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

  deleteThread(id: string): Promise<void> {
    return request<{ ok: boolean }>(
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

  deleteNote(id: string): Promise<void> {
    return request<{ ok: boolean }>(`/api/notes/${encodeURIComponent(id)}`, {
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
};
