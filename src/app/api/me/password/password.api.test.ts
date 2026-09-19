import { afterAll, describe, expect, test } from "bun:test";

import { POST as login } from "@/app/api/auth/login/route";
import { GET as getMe } from "@/app/api/me/route";
import {
  hashPassword,
  signSession,
  verifyPassword,
  verifyToken,
} from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth-shared";
import { db } from "@/lib/db";
import {
  PASSWORD_CONFIRM_MISMATCH,
  PASSWORD_NEW_TOO_SHORT,
  PASSWORD_RATE_LIMITED,
  PASSWORD_UNCHANGED,
  PASSWORD_WRONG_CURRENT,
} from "@/lib/password-copy";
import { resetRateLimit } from "@/lib/rate-limit";

import { PATCH as patchPassword } from "./route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  bearer?: string,
): Request {
  const headers = new Headers({ accept: "application/json" });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieHeader(res: Response): string {
  return typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie().join("\n")
    : (res.headers.get("set-cookie") ?? "");
}

function sessionCookieValue(res: Response): string | null {
  for (const line of cookieHeader(res).split("\n")) {
    const match = line.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

describe.skipIf(SKIP_PG)("PATCH /api/me/password", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string) {
    const user = await db.user.create({
      data: {
        name: label,
        email: `pw-${label}-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    const token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    resetRateLimit(`password:${user.id}:local`);
    return { user, token };
  }

  test("unauthenticated PATCH is 401", async () => {
    const res = await patchPassword(
      jsonRequest("http://localhost/api/me/password", "PATCH", {
        currentPassword: "password-ok",
        newPassword: "password-new",
        confirmPassword: "password-new",
      }),
    );
    expect(res.status).toBe(401);
  });

  test("wrong current is 400 Russian and does not leak", async () => {
    const { user, token } = await seedUser("wrong");
    const attempted = "definitely-not-the-password";
    const res = await patchPassword(
      jsonRequest(
        "http://localhost/api/me/password",
        "PATCH",
        {
          currentPassword: attempted,
          newPassword: "brand-new-99",
          confirmPassword: "brand-new-99",
          passwordHash: "injected",
          role: "admin",
        },
        token,
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      fields?: { currentPassword?: string };
      user?: unknown;
      token?: unknown;
    };
    expect(json.error).toBe(PASSWORD_WRONG_CURRENT);
    expect(json.fields?.currentPassword).toBe(PASSWORD_WRONG_CURRENT);
    expect(json.user).toBeUndefined();
    expect(json.token).toBeUndefined();
    const blob = JSON.stringify(json);
    expect(blob).not.toContain(attempted);
    expect(blob).not.toContain("brand-new-99");
    expect(blob).not.toMatch(/passwordHash|bcrypt|\$2[aby]\$/i);
    expect(PASSWORD_WRONG_CURRENT).toMatch(/[А-Яа-яЁё]/);

    const row = await db.user.findUnique({ where: { id: user.id } });
    expect(row?.role).toBe("client");
    expect(await verifyPassword("password-ok", row!.passwordHash)).toBe(true);
  });

  test("mismatch and short new password are 400 field errors", async () => {
    const { token } = await seedUser("fields");
    const mismatch = await patchPassword(
      jsonRequest(
        "http://localhost/api/me/password",
        "PATCH",
        {
          currentPassword: "password-ok",
          newPassword: "password-new",
          confirmPassword: "password-other",
        },
        token,
      ),
    );
    expect(mismatch.status).toBe(400);
    const mismatchJson = (await mismatch.json()) as {
      error: string;
      fields?: { confirmPassword?: string };
    };
    expect(mismatchJson.fields?.confirmPassword).toBe(PASSWORD_CONFIRM_MISMATCH);
    expect(JSON.stringify(mismatchJson)).not.toContain("password-new");

    const short = await patchPassword(
      jsonRequest(
        "http://localhost/api/me/password",
        "PATCH",
        {
          currentPassword: "password-ok",
          newPassword: "short",
          confirmPassword: "short",
        },
        token,
      ),
    );
    expect(short.status).toBe(400);
    const shortJson = (await short.json()) as { error: string };
    expect(shortJson.error).toBe(PASSWORD_NEW_TOO_SHORT);
  });

  test("same as current is 400; hash unchanged", async () => {
    const { user, token } = await seedUser("same");
    const res = await patchPassword(
      jsonRequest(
        "http://localhost/api/me/password",
        "PATCH",
        {
          currentPassword: "password-ok",
          newPassword: "password-ok",
          confirmPassword: "password-ok",
        },
        token,
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe(PASSWORD_UNCHANGED);
    const row = await db.user.findUnique({ where: { id: user.id } });
    expect(await verifyPassword("password-ok", row!.passwordHash)).toBe(true);
  });

  test("success re-issues session, never prints the new password, old login fails", async () => {
    const { user, token } = await seedUser("ok");
    const nextSecret = `fresh-${stamp}-secret`;
    const patched = await patchPassword(
      jsonRequest(
        "http://localhost/api/me/password",
        "PATCH",
        {
          currentPassword: "password-ok",
          newPassword: nextSecret,
          confirmPassword: nextSecret,
          email: "hijack@example.test",
          role: "admin",
          id: "someone-else",
        },
        token,
      ),
    );
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as {
      user: { id: string; email: string; role: string; name: string };
      token?: string;
    };
    expect(patchedJson.user.id).toBe(user.id);
    expect(patchedJson.user.email).toBe(user.email);
    expect(patchedJson.user.role).toBe("client");
    expect(patchedJson.token).toBeTruthy();
    expect(patchedJson.token).not.toBe(token);

    const blob = JSON.stringify(patchedJson);
    expect(blob).not.toContain(nextSecret);
    expect(blob).not.toMatch(/passwordHash|currentPassword|newPassword|confirmPassword/i);

    const cookies = cookieHeader(patched);
    expect(cookies).toMatch(new RegExp(`${SESSION_COOKIE}=`));

    const payload = await verifyToken(patchedJson.token!, "session");
    expect(payload?.sub).toBe(user.id);
    expect(payload?.email).toBe(user.email);
    expect(payload?.tokenVersion).toBe(1);

    const stale = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, token),
    );
    expect(stale.status).toBe(401);

    const row = await db.user.findUnique({ where: { id: user.id } });
    expect(row?.tokenVersion).toBe(1);
    expect(row?.email).toBe(user.email);
    expect(row?.role).toBe("client");
    expect(await verifyPassword(nextSecret, row!.passwordHash)).toBe(true);
    expect(await verifyPassword("password-ok", row!.passwordHash)).toBe(false);

    const me = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, patchedJson.token),
    );
    expect(me.status).toBe(200);

    const oldLogin = await login(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        email: user.email,
        password: "password-ok",
      }),
    );
    expect(oldLogin.status).toBe(401);

    resetRateLimit(`login:${user.email}:local`);
    const newLogin = await login(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        email: user.email,
        password: nextSecret,
      }),
    );
    expect(newLogin.status).toBe(200);
    const loginJson = (await newLogin.json()) as { token?: string; user: { id: string } };
    expect(loginJson.user.id).toBe(user.id);
    expect(JSON.stringify(loginJson)).not.toContain(nextSecret);
  });

  test("login, change password: old Bearer and cookie 401, new token 200", async () => {
    const { user } = await seedUser("kill-session");
    resetRateLimit(`login:${user.email}:local`);
    const loggedIn = await login(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        email: user.email,
        password: "password-ok",
      }),
    );
    expect(loggedIn.status).toBe(200);
    const loginJson = (await loggedIn.json()) as { token?: string };
    expect(loginJson.token).toBeTruthy();
    const oldBearer = loginJson.token!;
    const oldCookie = sessionCookieValue(loggedIn);
    expect(oldCookie).toBeTruthy();

    const before = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, oldBearer),
    );
    expect(before.status).toBe(200);

    const nextSecret = `kill-${stamp}-secret`;
    const patched = await patchPassword(
      jsonRequest(
        "http://localhost/api/me/password",
        "PATCH",
        {
          currentPassword: "password-ok",
          newPassword: nextSecret,
          confirmPassword: nextSecret,
        },
        oldBearer,
      ),
    );
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as { token?: string };
    expect(patchedJson.token).toBeTruthy();
    expect(patchedJson.token).not.toBe(oldBearer);

    const staleBearer = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, oldBearer),
    );
    expect(staleBearer.status).toBe(401);

    const staleCookie = await getMe(
      new Request("http://localhost/api/me", {
        method: "GET",
        headers: {
          accept: "application/json",
          cookie: `${SESSION_COOKIE}=${oldCookie}`,
        },
      }),
    );
    expect(staleCookie.status).toBe(401);

    const fresh = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, patchedJson.token),
    );
    expect(fresh.status).toBe(200);

    resetRateLimit(`login:${user.email}:local`);
    const relogin = await login(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        email: user.email,
        password: nextSecret,
      }),
    );
    expect(relogin.status).toBe(200);
    const reloginJson = (await relogin.json()) as { token?: string };
    const afterLogin = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, reloginJson.token),
    );
    expect(afterLogin.status).toBe(200);
  });

  test("repeated wrong current is rate-limited like login", async () => {
    const { token } = await seedUser("rate");
    let lastStatus = 0;
    let lastError = "";
    for (let i = 0; i < 9; i++) {
      const res = await patchPassword(
        jsonRequest(
          "http://localhost/api/me/password",
          "PATCH",
          {
            currentPassword: "wrong-password",
            newPassword: "password-new",
            confirmPassword: "password-new",
          },
          token,
        ),
      );
      lastStatus = res.status;
      const json = (await res.json()) as { error?: string };
      lastError = json.error ?? "";
    }
    expect(lastStatus).toBe(429);
    expect(lastError).toBe(PASSWORD_RATE_LIMITED);
    expect(lastError).toMatch(/[А-Яа-яЁё]/);
  });
});
