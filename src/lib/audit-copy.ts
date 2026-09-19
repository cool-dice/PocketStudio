/**
 * Honest admin audit trail. A failed load is not «журнал пуст»;
 * 403 is not an empty list; rows never echo API keys or raw meta.
 */

import type { AuditLogEntry } from "@/lib/types";

export const AUDIT_EMPTY = "Журнал пока пуст";
export const AUDIT_EMPTY_HINT =
  "Входы, регистрации и действия администраторов появятся здесь.";
export const AUDIT_LOAD_ERROR = "Не удалось загрузить журнал";
export const AUDIT_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой журнал.";
export const AUDIT_FORBIDDEN = "Доступ только для администраторов";
export const AUDIT_FORBIDDEN_HINT =
  "Журнал событий недоступен с ролью клиента.";
export const AUDIT_RETRY = "Повторить";
export const AUDIT_LOAD_MORE = "Показать ещё";
export const AUDIT_TITLE = "Журнал событий";
export const AUDIT_HINT =
  "Входы, регистрации и действия администраторов";
export const AUDIT_LIMIT_INVALID =
  "Параметр limit должен быть целым числом от 1 до 200";
export const AUDIT_OFFSET_INVALID =
  "Параметр offset должен быть целым числом от 0";

export const AUDIT_LIMIT_DEFAULT = 30;
export const AUDIT_LIMIT_MAX = 200;

const SECRET_KEY_RE =
  /^(api[-_]?key|access[-_]?token|refresh[-_]?token|secret|password|passwd|authorization|bearer|private[-_]?key|client[-_]?secret)$/i;
const SECRET_VALUE_RE =
  /\b(?:sk-ant-[A-Za-z0-9_-]{10,}|sk-[A-Za-z0-9_-]{10,}|Bearer\s+\S{8,})\b/gi;

export type AuditListView =
  | "loading"
  | "error"
  | "forbidden"
  | "empty"
  | "ready";

export type AuditPageParse =
  | { ok: true; limit: number; offset: number }
  | { ok: false; error: string };

export function auditListView(
  loading: boolean,
  loadError: string | null,
  count: number,
): AuditListView {
  if (loading) return "loading";
  if (loadError === AUDIT_FORBIDDEN) return "forbidden";
  if (loadError) return "error";
  if (count === 0) return "empty";
  return "ready";
}

export function auditLoadErrorFromHttp(
  status: number,
  fallback?: string,
): string {
  if (status === 403) return AUDIT_FORBIDDEN;
  const trimmed = fallback?.trim();
  return trimmed || AUDIT_LOAD_ERROR;
}

function parseCount(
  raw: string | null,
  fallback: number,
  min: number,
  max: number,
  error: string,
): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === null || raw === "") return { ok: true, value: fallback };
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { ok: false, error };
  }
  return { ok: true, value: n };
}

export function parseAuditPage(
  limitRaw: string | null,
  offsetRaw: string | null,
): AuditPageParse {
  const limit = parseCount(
    limitRaw,
    AUDIT_LIMIT_DEFAULT,
    1,
    AUDIT_LIMIT_MAX,
    AUDIT_LIMIT_INVALID,
  );
  if (!limit.ok) return limit;
  const offset = parseCount(
    offsetRaw,
    0,
    0,
    Number.MAX_SAFE_INTEGER,
    AUDIT_OFFSET_INVALID,
  );
  if (!offset.ok) return offset;
  return { ok: true, limit: limit.value, offset: offset.value };
}

/** Caller fetched `limit + 1` rows. */
export function auditPageHasMore(fetchedCount: number, limit: number): boolean {
  return fetchedCount > limit;
}

export function isSecretAuditKey(key: string): boolean {
  return SECRET_KEY_RE.test(key.trim());
}

export function redactSecretText(value: string): string {
  SECRET_VALUE_RE.lastIndex = 0;
  return value.replace(SECRET_VALUE_RE, "[redacted]");
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function redactNullable(value: string | null | undefined): string | null {
  if (value == null) return null;
  return redactSecretText(String(value));
}

/**
 * Public list DTO: never `meta`, never secret keys, redact sk-/Bearer values.
 * Extra fields on the DB row (apiKey, password, …) are dropped.
 */
export function toPublicAuditEntry(row: {
  id: string;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  createdAt: Date | string;
  user?: { name: string; email: string } | null;
  meta?: unknown;
}): AuditLogEntry {
  return {
    id: String(row.id),
    action: redactSecretText(String(row.action)),
    entity: redactNullable(row.entity),
    entityId: redactNullable(row.entityId),
    createdAt: isoDate(row.createdAt),
    user: row.user
      ? { name: row.user.name, email: row.user.email }
      : null,
  };
}
