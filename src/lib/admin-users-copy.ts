/**
 * Honest admin users list. A failed load is not «пока нет пользователей»;
 * 403 is not an empty list; DTOs never echo passwordHash.
 */

import type { AdminUserListItem, Role } from "@/lib/types";

export const USERS_EMPTY = "Пока нет пользователей";
export const USERS_EMPTY_FILTER =
  "Никого не найдено — попробуйте изменить фильтр";
export const USERS_LOAD_ERROR = "Не удалось загрузить пользователей";
export const USERS_LOAD_ERROR_HINT =
  "Проверьте соединение и обновите — это не пустой список.";
export const USERS_FORBIDDEN = "Доступ только для администраторов";
export const USERS_FORBIDDEN_HINT =
  "Список пользователей недоступен с ролью клиента.";
export const USERS_RETRY = "Повторить";
export const LAST_ADMIN_DEMOTE = "Нельзя снять последнего администратора";
export const LAST_ADMIN_DELETE = "Нельзя удалить последнего администратора";
export const SELF_ROLE_CHANGE = "Нельзя изменить собственную роль";
export const SELF_USER_DELETE = "Нельзя удалить свой аккаунт из админ-панели";
export const USER_NOT_FOUND = "Пользователь не найден";
export const ROLE_CHANGE_FAILED = "Не удалось изменить роль";
export const ROLE_PARAM_INVALID = "Параметр role должен быть admin или client";

/** Personal-scale cap; GET /api/admin/users fetches cap+1 so hasMore is honest. */
export const MAX_ADMIN_USERS = 500;

/** Caller fetched `max + 1` rows. */
export function usersPageHasMore(
  fetchedCount: number,
  max: number = MAX_ADMIN_USERS,
): boolean {
  return fetchedCount > max;
}

export type AdminUsersListView =
  | "loading"
  | "error"
  | "forbidden"
  | "empty"
  | "ready";

export type RoleChangeBlock = "self" | "last-admin" | null;
export type UserDeleteBlock = "self" | "last-admin" | null;

export function adminUsersListView(
  loading: boolean,
  loadError: string | null,
  count: number,
): AdminUsersListView {
  if (loading) return "loading";
  if (loadError === USERS_FORBIDDEN) return "forbidden";
  if (loadError) return "error";
  if (count === 0) return "empty";
  return "ready";
}

export function adminUsersLoadErrorFromHttp(
  status: number,
  fallback?: string,
): string {
  if (status === 403) return USERS_FORBIDDEN;
  const trimmed = fallback?.trim();
  return trimmed || USERS_LOAD_ERROR;
}

export function adminUsersEmptyCopy(filtered: boolean): string {
  return filtered ? USERS_EMPTY_FILTER : USERS_EMPTY;
}

/**
 * Last-admin demotion wins over self: the studio must keep one admin.
 * Self-demote is still blocked when other admins exist.
 */
export function roleChangeBlock(input: {
  actorId: string;
  targetId: string;
  targetRole: string;
  nextRole: string;
  adminCount: number;
}): RoleChangeBlock {
  const demotingAdmin =
    input.targetRole === "admin" && input.nextRole === "client";
  if (demotingAdmin && input.adminCount <= 1) return "last-admin";
  if (input.targetId === input.actorId) return "self";
  return null;
}

export function roleChangeError(
  block: Exclude<RoleChangeBlock, null>,
): string {
  return block === "last-admin" ? LAST_ADMIN_DEMOTE : SELF_ROLE_CHANGE;
}

/**
 * Self-delete wins: the panel copy is «свой аккаунт», even if that
 * row is also the last admin. Last-admin still blocks deleting a peer
 * when the locked count is 1 (the parallel-delete race).
 */
export function userDeleteBlock(input: {
  actorId: string;
  targetId: string;
  targetRole: string;
  adminCount: number;
}): UserDeleteBlock {
  if (input.targetId === input.actorId) return "self";
  if (input.targetRole === "admin" && input.adminCount <= 1) {
    return "last-admin";
  }
  return null;
}

export function userDeleteError(
  block: Exclude<UserDeleteBlock, null>,
): string {
  return block === "last-admin" ? LAST_ADMIN_DELETE : SELF_USER_DELETE;
}

export function roleChangedToast(name: string, role: Role): string {
  return role === "admin"
    ? `${name} теперь администратор`
    : `${name} теперь обычный пользователь`;
}

function isoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Public list DTO: allowlisted fields only. Extra Prisma columns
 * (passwordHash, tokenVersion, …) are dropped.
 */
export function toPublicAdminUserListItem(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date | string;
  lastActivity?: Date | string | null;
  counts?: { notes?: number; threads?: number; projects?: number };
  passwordHash?: string;
}): AdminUserListItem {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    role: row.role === "admin" ? "admin" : "client",
    createdAt: isoDate(row.createdAt),
    lastActivity: row.lastActivity ? isoDate(row.lastActivity) : null,
    counts: {
      notes: row.counts?.notes ?? 0,
      threads: row.counts?.threads ?? 0,
      projects: row.counts?.projects ?? 0,
    },
  };
}
