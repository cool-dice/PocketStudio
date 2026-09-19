import { describe, expect, test } from "bun:test";
import { NextResponse } from "next/server";

import {
  attachSessionCookie,
  clearSessionCookieOptions,
  clearSessionCookies,
  readSessionToken,
  sessionCookieOptions,
  sessionCookieSecure,
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

type CookieOpts = ReturnType<typeof sessionCookieOptions>;

function setCookieLines(res: { headers: Headers }): string[] {
  if (typeof res.headers.getSetCookie === "function") {
    return res.headers.getSetCookie();
  }
  const raw = res.headers.get("set-cookie");
  return raw ? [raw] : [];
}

function cookieLine(res: { headers: Headers }, name: string): string {
  const line = setCookieLines(res).find((entry) =>
    entry.toLowerCase().startsWith(`${name.toLowerCase()}=`),
  );
  expect(line).toBeTruthy();
  return line!;
}

function cookieFlags(line: string): string[] {
  return line
    .split(";")
    .slice(1)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function expectSessionCookieFlags(
  line: string,
  opts: { expired?: boolean; secure: boolean },
) {
  const flags = cookieFlags(line);
  expect(flags).toContain("httponly");
  expect(flags).toContain("samesite=lax");
  expect(flags).toContain("path=/");
  if (opts.expired) {
    expect(flags).toContain("max-age=0");
  } else {
    expect(flags.some((flag) => /^max-age=\d+$/.test(flag) && flag !== "max-age=0")).toBe(
      true,
    );
  }
  expect(flags.includes("secure")).toBe(opts.secure);
}

describe("session cookie flags", () => {
  test("httpOnly + SameSite=Lax; Secure only in production", () => {
    expect(sessionCookieSecure("production")).toBe(true);
    expect(sessionCookieSecure("development")).toBe(false);
    expect(sessionCookieSecure("test")).toBe(false);

    const prod = sessionCookieOptions("production");
    expect(prod).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
    expect(prod.maxAge).toBeGreaterThan(0);

    const nonProd = sessionCookieOptions("test");
    expect(nonProd.httpOnly).toBe(true);
    expect(nonProd.sameSite).toBe("lax");
    expect(nonProd.secure).toBe(false);

    const clearProd = clearSessionCookieOptions("production");
    expect(clearProd.httpOnly).toBe(true);
    expect(clearProd.sameSite).toBe("lax");
    expect(clearProd.secure).toBe(true);
    expect(clearProd.maxAge).toBe(0);
  });

  test("login Set-Cookie writes httpOnly Lax ps_session (Secure in production)", () => {
    const live = NextResponse.json({ token: "tok-live" });
    attachSessionCookie(live, "tok-live");
    const liveLine = cookieLine(live, SESSION_COOKIE);
    expect(liveLine).toContain("tok-live");
    expectSessionCookieFlags(liveLine, {
      secure: sessionCookieSecure(),
    });
    const expiredLegacy = cookieLine(live, LEGACY_SESSION_COOKIE);
    expectSessionCookieFlags(expiredLegacy, {
      expired: true,
      secure: sessionCookieSecure(),
    });

    const prod = NextResponse.json({ token: "tok-prod" });
    prod.cookies.set(SESSION_COOKIE, "tok-prod", sessionCookieOptions("production"));
    expectSessionCookieFlags(cookieLine(prod, SESSION_COOKIE), { secure: true });
  });

  test("logout Set-Cookie expires ps_session with the same flags", () => {
    const live = NextResponse.json({ ok: true });
    clearSessionCookies(live);
    expectSessionCookieFlags(cookieLine(live, SESSION_COOKIE), {
      expired: true,
      secure: sessionCookieSecure(),
    });
    expectSessionCookieFlags(cookieLine(live, LEGACY_SESSION_COOKIE), {
      expired: true,
      secure: sessionCookieSecure(),
    });

    const prod = NextResponse.json({ ok: true });
    prod.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions("production"));
    expectSessionCookieFlags(cookieLine(prod, SESSION_COOKIE), {
      expired: true,
      secure: true,
    });
  });
});

describe("attachSessionCookie", () => {
  test("writes ps_session and expires vf_session", () => {
    const store = new Map<string, { value: string; opts: CookieOpts }>();
    const res = {
      cookies: {
        set(name: string, value: string, opts: CookieOpts) {
          store.set(name, { value, opts });
        },
      },
    };
    attachSessionCookie(res, "tok-123");
    expect(store.get(SESSION_COOKIE)?.value).toBe("tok-123");
    expect(store.get(SESSION_COOKIE)?.opts).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    expect(store.get(LEGACY_SESSION_COOKIE)?.value).toBe("");
    expect(store.get(LEGACY_SESSION_COOKIE)?.opts.maxAge).toBe(0);
  });
});
