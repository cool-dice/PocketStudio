/**
 * Invite lifecycle + Russian copy shared by admin list, register, and peek API.
 */

export type InviteLifecycle = "ok" | "used" | "expired" | "invalid";

export function inviteLifecycle(
  row:
    | {
        usedAt?: Date | string | null;
        expiresAt?: Date | string | null;
      }
    | null
    | undefined,
  now = Date.now(),
): InviteLifecycle {
  if (!row) return "invalid";
  if (row.usedAt) return "used";
  if (!row.expiresAt) return "ok";
  const exp =
    row.expiresAt instanceof Date
      ? row.expiresAt.getTime()
      : Date.parse(String(row.expiresAt));
  if (Number.isFinite(exp) && exp < now) return "expired";
  return "ok";
}

export function inviteListLabel(status: InviteLifecycle): string {
  switch (status) {
    case "ok":
      return "ожидает";
    case "used":
      return "использован";
    case "expired":
      return "истёк";
    case "invalid":
      return "недействителен";
  }
}

export function inviteRegisterCopy(status: InviteLifecycle): string {
  switch (status) {
    case "ok":
      return "Регистрация по приглашению";
    case "used":
      return "Этот инвайт уже использован — зарегистрироваться по нему нельзя.";
    case "expired":
      return "Срок инвайта истёк — попросите новую ссылку.";
    case "invalid":
      return "Инвайт недействителен.";
  }
}

export function inviteRoleLabel(role: string): "админ" | "клиент" {
  return role === "admin" ? "админ" : "клиент";
}

export function sanitizeInviteRole(
  role: string | null | undefined,
): "admin" | "client" {
  return role === "admin" ? "admin" : "client";
}
