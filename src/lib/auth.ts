// Server-only auth helpers: password hashing + JWT sessions (jose HS256).
import * as bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { AUTH_SECRET, SESSION_COOKIE, type SessionPayload } from "./auth-shared";

const secretKey = new TextEncoder().encode(AUTH_SECRET);

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const WS_TOKEN_TTL_SECONDS = 60; // 60 seconds

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setAudience("session")
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey);
}

export async function signWsToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
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
    return {
      sub: typeof payload.sub === "string" ? payload.sub : "",
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
      role: typeof payload.role === "string" ? payload.role : "client",
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

/**
 * Resolve the current user from a request:
 * 1) `Authorization: Bearer <token>` header
 * 2) `vf_session` cookie
 * Returns null when unauthenticated.
 */
export async function getUserFromRequest(req: Request): Promise<SessionPayload | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const payload = await verifyToken(token, "session");
      if (payload) return payload;
    }
  }

  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieToken = cookies[SESSION_COOKIE];
  if (cookieToken) {
    return verifyToken(cookieToken, "session");
  }
  return null;
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
