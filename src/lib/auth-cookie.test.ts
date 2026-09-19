import { describe, expect, test } from "bun:test";

import {
  attachSessionCookie,
  readSessionToken,
  signSession,
  verifyToken,
} from "./auth";
import {
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
} from "./auth-shared";

function cookieRequest(cookie: string): Request {
  return new Request("http://localhost/api/auth/me", {
    headers: { cookie },
  });
}

function jwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  return JSON.parse(Buffer.from(part, "base64url").toString()) as Record<
    string,
    unknown
  >;
}

describe("session cookie branding", () => {
  test("PocketStudio cookie name is ps_session, not vf_session", () => {
    expect(SESSION_COOKIE).toBe("ps_session");
    expect(LEGACY_SESSION_COOKIE).toBe("vf_session");
  });

  test("dual-reads legacy vf_session and current ps_session", async () => {
    const token = await signSession({
      sub: "user-cookie",
      email: "cookie@example.test",
      name: "Cookie",
      role: "client",
    });
    expect(readSessionToken(cookieRequest(`${SESSION_COOKIE}=${token}`))).toBe(
      token,
    );
    expect(
      readSessionToken(cookieRequest(`${LEGACY_SESSION_COOKIE}=${token}`)),
    ).toBe(token);
    const payload = await verifyToken(token, "session");
    expect(payload?.sub).toBe("user-cookie");
    expect(payload?.tokenVersion).toBe(0);
  });

  test("Bearer still wins over cookies", async () => {
    const bearer = await signSession({
      sub: "bearer-user",
      email: "b@example.test",
      name: "B",
      role: "admin",
    });
    const cookieTok = await signSession({
      sub: "cookie-user",
      email: "c@example.test",
      name: "C",
      role: "client",
    });
    const token = readSessionToken(
      new Request("http://localhost/api/auth/me", {
        headers: {
          authorization: `Bearer ${bearer}`,
          cookie: `${SESSION_COOKIE}=${cookieTok}`,
        },
      }),
    );
    expect(token).toBe(bearer);
  });
});

describe("signSession", () => {
  test("re-issue in the same second gets a distinct token (jti)", async () => {
    const payload = {
      sub: "user-jti",
      email: "jti@example.test",
      name: "Jti",
      role: "client" as const,
    };
    const a = await signSession(payload);
    const b = await signSession(payload);
    expect(a).not.toBe(b);
    expect((await verifyToken(a, "session"))?.sub).toBe("user-jti");
    expect((await verifyToken(b, "session"))?.sub).toBe("user-jti");
  });

  test("JWT embeds tokenVersion (default 0)", async () => {
    const token = await signSession({
      sub: "user-tv",
      email: "tv@example.test",
      name: "Tv",
      role: "client",
      tokenVersion: 3,
    });
    expect(jwtPayload(token).tokenVersion).toBe(3);
    expect((await verifyToken(token, "session"))?.tokenVersion).toBe(3);

    const legacyShaped = await signSession({
      sub: "user-tv0",
      email: "tv0@example.test",
      name: "Tv0",
      role: "client",
    });
    expect(jwtPayload(legacyShaped).tokenVersion).toBe(0);
  });
});

describe("attachSessionCookie", () => {
  test("writes ps_session and expires vf_session", () => {
    const store = new Map<string, { value: string; maxAge?: number }>();
    const res = {
      cookies: {
        set(name: string, value: string, opts: { maxAge?: number }) {
          store.set(name, { value, maxAge: opts.maxAge });
        },
      },
    };
    attachSessionCookie(res, "tok-123");
    expect(store.get(SESSION_COOKIE)?.value).toBe("tok-123");
    expect(store.get(LEGACY_SESSION_COOKIE)?.value).toBe("");
    expect(store.get(LEGACY_SESSION_COOKIE)?.maxAge).toBe(0);
  });
});
