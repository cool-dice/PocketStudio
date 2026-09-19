// Shared auth constants & types (safe to import from client and server).
// Cookie/token names were `vf_*` (VibeFlow). Dual-read the legacy keys so
// existing sessions survive the PocketStudio rename.
export const AUTH_SECRET = process.env.AUTH_SECRET || "vf-dev-secret-change-me";
export const SESSION_COOKIE = "ps_session";
export const LEGACY_SESSION_COOKIE = "vf_session";
export const TOKEN_STORAGE_KEY = "ps_token";
export const LEGACY_TOKEN_STORAGE_KEY = "vf_token";

export interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}
