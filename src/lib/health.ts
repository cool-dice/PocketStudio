/**
 * Public health JSON. Liveness answers are up/down only — never env,
 * connection strings, or exception text (Prisma errors can embed DATABASE_URL).
 */

export type HealthStatus = "up" | "down";

export const HEALTH_DOWN_ERROR = "Сервис недоступен";
export const AGENT_UNAVAILABLE = "Агент недоступен";
export const AGENT_SUPERVISOR_MISSING = "Не найден супервизор агента";
export const AUTH_REQUIRED = "Требуется авторизация";

export const APP_HEALTH_KEYS = ["status"] as const;
export const AGENT_PROBE_KEYS = ["up"] as const;
export const AGENT_START_KEYS = ["up", "started"] as const;
export const AGENT_START_ERROR_KEYS = ["up", "started", "error"] as const;
export const ERROR_ONLY_KEYS = ["error"] as const;

const SECRET_LEAK_RE =
  /DATABASE_URL|AUTH_SECRET|passwordHash|postgresql:\/\/|postgres:\/\/|at\s+\S+\s+\([^)]+:\d+:\d+\)/i;

export function appHealthJson(dbUp: boolean): { status: HealthStatus } {
  return { status: dbUp ? "up" : "down" };
}

export function agentProbeJson(up: boolean): { up: boolean } {
  return { up };
}

export function agentStartJson(
  up: boolean,
  started: boolean,
): { up: boolean; started: boolean } {
  return { up, started };
}

export function agentStartErrorJson(
  started: boolean,
  error: string = AGENT_SUPERVISOR_MISSING,
): { up: false; started: boolean; error: string } {
  return { up: false, started, error };
}

export function genericErrorJson(error: string): { error: string } {
  return { error };
}

/** Always a canned phrase — never `err.message` / stack. */
export function healthCatchMessage(_err: unknown): string {
  return HEALTH_DOWN_ERROR;
}

export function agentCatchMessage(_err: unknown): string {
  return AGENT_UNAVAILABLE;
}

export async function probeUp(probe: () => Promise<unknown>): Promise<boolean> {
  try {
    await probe();
    return true;
  } catch {
    return false;
  }
}

export function jsonLooksLikeSecretLeak(value: unknown): boolean {
  const blob = typeof value === "string" ? value : JSON.stringify(value);
  return SECRET_LEAK_RE.test(blob);
}
