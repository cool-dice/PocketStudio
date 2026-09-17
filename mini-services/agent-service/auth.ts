// WS auth — same JWT secret as the main app (Next :3000).
// The main app issues short-lived ws-tokens via GET /api/auth/ws-token
// (jose HS256, audience "ws", 60s). Session tokens (no audience) are
// accepted as a fallback so existing cookies work too.

import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

export interface WsUser {
  sub: string;
  email: string;
  name: string;
  role: string;
}

function toUser(payload: Record<string, unknown>): WsUser | null {
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  if (!sub) return null;
  return {
    sub,
    email: typeof payload.email === "string" ? payload.email : "",
    name: typeof payload.name === "string" ? payload.name : "",
    role: typeof payload.role === "string" ? payload.role : "client",
  };
}

export async function verifyWsToken(token: string): Promise<WsUser | null> {
  // 1) ws-token (audience "ws")
  try {
    const { payload } = await jwtVerify(token, secret, { audience: "ws" });
    const user = toUser(payload as Record<string, unknown>);
    if (user) return user;
  } catch {
    /* fall through to session-token attempt */
  }

  // 2) session token (audience absent)
  try {
    const { payload } = await jwtVerify(token, secret);
    return toUser(payload as Record<string, unknown>);
  } catch {
    return null;
  }
}
