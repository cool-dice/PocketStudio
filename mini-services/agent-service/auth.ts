// WS auth — same JWT secret as the main app (Next :3000).
// The main app issues short-lived ws-tokens via GET /api/auth/ws-token
// (jose HS256, audience "ws", 60s). Session tokens (audience "session") are
// accepted as a fallback so existing cookies work too.
// User.tokenVersion must match the JWT claim — password change / logout-all kill both.

import { jwtVerify } from "jose";

import { db } from "./db-client";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export interface WsUser {
  sub: string;
  email: string;
  name: string;
  role: string;
  tokenVersion: number;
}

function readTokenVersion(value: unknown): number | null {
  if (value === undefined) return 0;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  return null;
}

function toUser(payload: Record<string, unknown>): WsUser | null {
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) return null;
  const tokenVersion = readTokenVersion(payload.tokenVersion);
  if (tokenVersion === null) return null;
  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : "",
    name: typeof payload.name === "string" ? payload.name : "",
    role: typeof payload.role === "string" ? payload.role : "client",
    tokenVersion,
  };
}

async function matchLiveUser(user: WsUser): Promise<WsUser | null> {
  const row = await db.user.findUnique({
    where: { id: user.sub },
    select: { tokenVersion: true },
  });
  if (!row || row.tokenVersion !== user.tokenVersion) return null;
  return user;
}

export async function verifyWsToken(token: string): Promise<WsUser | null> {
  // 1) ws-token (audience "ws")
  try {
    const { payload } = await jwtVerify(token, secret, { audience: "ws" });
    const user = toUser(payload as Record<string, unknown>);
    if (user) return matchLiveUser(user);
  } catch {
    /* fall through to session-token attempt */
  }

  // 2) session token (audience "session" or absent)
  try {
    const { payload } = await jwtVerify(token, secret);
    const user = toUser(payload as Record<string, unknown>);
    if (!user) return null;
    return matchLiveUser(user);
  } catch {
    return null;
  }
}
