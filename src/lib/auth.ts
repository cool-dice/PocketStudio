// Server-only auth helpers: password hashing + JWT sessions (jose HS256).
import * as bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import {
  AUTH_SECRET,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
  type SessionPayload,
} from "./auth-shared";
import { db } from "./db";

const secretKey = new TextEncoder().encode(AUTH_SECRET);

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const WS_TOKEN_TTL_SECONDS = 60; // 60 seconds

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function sessionPayloadFromUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  tokenVersion: number;
}): SessionPayload {
  return {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion,
  };
}

function jwtClaims(payload: SessionPayload) {
  return {
    email: payload.email,
    name: payload.name,
    role: payload.role,
    tokenVersion: embedTokenVersion(payload.tokenVersion),
  };
}

function embedTokenVersion(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return 0;
}

function readTokenVersion(value: unknown): number | null {
  if (value === undefined) return 0;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return null;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(jwtClaims(payload))
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setAudience("session")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function signWsToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(jwtClaims(payload))
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setAudience("ws")
    .setExpirationTime(`${WS_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function verifyToken(
  token: string,
  expectedAud?: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(
      token,
      secretKey,
      expectedAud ? { audience: expectedAud } : undefined
    );
    const tokenVersion = readTokenVersion(payload.tokenVersion);
    if (tokenVersion === null) return null;
    return {
      sub: typeof payload.sub === "string" ? payload.sub : "",
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
      role: typeof payload.role === "string" ? payload.role : "client",
      tokenVersion,
    };
  } catch {
    return null;
  }
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(raw);
    } catch {
      out[key] = raw;
    }
  }
  return out;
}

/** First session token on the request: Bearer, then ps_session, then vf_session. */
export function readSessionToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const cookies = parseCookies(req.headers.get("cookie"));
  for (const name of [SESSION_COOKIE, LEGACY_SESSION_COOKIE]) {
    const cookieToken = cookies[name];
    if (cookieToken) return cookieToken;
  }
  return null;
}

async function matchLiveSession(
  payload: SessionPayload,
): Promise<SessionPayload | null> {
  if (!payload.sub) return null;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { tokenVersion: true },
  });
  if (!user) return null;
  if (user.tokenVersion !== payload.tokenVersion) return null;
  return payload;
}

async function verifyLiveSessionToken(token: string): Promise<SessionPayload | null> {
  const payload = await verifyToken(token, "session");
  if (!payload) return null;
  return matchLiveSession(payload);
}

/**
 * Resolve the current user from a request:
 * 1) `Authorization: Bearer <token>` header
 * 2) `ps_session` cookie (PocketStudio)
 * 3) `vf_session` cookie (legacy VibeFlow — dual-read until sessions expire)
 * Signature-valid tokens still fail when User.tokenVersion does not match.
 * Returns null when unauthenticated.
 */
export async function getUserFromRequest(req: Request): Promise<SessionPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const payload = await verifyLiveSessionToken(token);
      if (payload) return payload;
    }
  }

  const cookies = parseCookies(req.headers.get("cookie"));
  for (const name of [SESSION_COOKIE, LEGACY_SESSION_COOKIE]) {
    const cookieToken = cookies[name];
    if (cookieToken) {
      const payload = await verifyLiveSessionToken(cookieToken);
      if (payload) return payload;
    }
  }
  return null;
}

/** Write the PocketStudio session cookie and expire the legacy VibeFlow one. */
export function attachSessionCookie(res: { cookies: { set: (name: string, value: string, opts: ReturnType<typeof sessionCookieOptions>) => void } }, token: string) {
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  res.cookies.set(LEGACY_SESSION_COOKIE, "", clearSessionCookieOptions());
}

export function clearSessionCookies(res: { cookies: { set: (name: string, value: string, opts: ReturnType<typeof clearSessionCookieOptions>) => void } }) {
  res.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  res.cookies.set(LEGACY_SESSION_COOKIE, "", clearSessionCookieOptions());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function clearSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: 0,
  };
}
