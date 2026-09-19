import { describe, expect, test } from "bun:test";

import {
  attachSessionCookie,
  getUserFromRequest,
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
    const fromNew = await getUserFromRequest(
      cookieRequest(`${SESSION_COOKIE}=${token}`),
    );
    const fromLegacy = await getUserFromRequest(
      cookieRequest(`${LEGACY_SESSION_COOKIE}=${token}`),
    );
    expect(fromNew?.sub).toBe("user-cookie");
    expect(fromLegacy?.sub).toBe("user-cookie");
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
    const payload = await getUserFromRequest(
      new Request("http://localhost/api/auth/me", {
        headers: {
          authorization: `Bearer ${bearer}`,
          cookie: `${SESSION_COOKIE}=${cookieTok}`,
        },
      }),
    );
    expect(payload?.sub).toBe("bearer-user");
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
