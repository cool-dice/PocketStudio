// Shared auth constants & types (safe to import from client and server).
export const AUTH_SECRET = process.env.AUTH_SECRET || "vf-dev-secret-change-me";
export const SESSION_COOKIE = "vf_session";

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}
