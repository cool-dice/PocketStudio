import { afterAll, describe, expect, test } from "bun:test";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as getMe } from "@/app/api/me/route";
import { hashPassword, signSession } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth-shared";
import { db } from "@/lib/db";
import { resetRateLimit } from "@/lib/rate-limit";

import { POST as logoutAll } from "./route";

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

describe.skipIf(SKIP_PG)("POST /api/auth/logout-all", () => {
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
        email: `logout-all-${label}-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    resetRateLimit(`login:${user.email}:local`);
    return user;
  }

  async function twoTokens(user: { id: string; email: string; name: string; role: string }) {
    const a = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    const b = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    expect(a).not.toBe(b);
    return { a, b };
  }

  test("unauthenticated logout-all is 401", async () => {
    const res = await logoutAll(
      jsonRequest("http://localhost/api/auth/logout-all", "POST"),
    );
    expect(res.status).toBe(401);
  });

  test("regular logout only clears this cookie; the other token still works", async () => {
    const user = await seedUser("one-device");
    const { a, b } = await twoTokens(user);

    const loggedOut = await logout(
      jsonRequest("http://localhost/api/auth/logout", "POST", undefined, a),
    );
    expect(loggedOut.status).toBe(200);
    const cookies = cookieHeader(loggedOut);
    expect(cookies).toMatch(new RegExp(`${SESSION_COOKIE}=`));
    expect(cookies).toMatch(/Max-Age=0/i);

    const stillA = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, a),
    );
    expect(stillA.status).toBe(200);

    const stillB = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, b),
    );
    expect(stillB.status).toBe(200);

    const row = await db.user.findUnique({ where: { id: user.id } });
    expect(row?.tokenVersion).toBe(0);
  });

  test("two tokens: logout-all 401s both old; login again works", async () => {
    const user = await seedUser("everywhere");
    const { a, b } = await twoTokens(user);

    const beforeA = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, a),
    );
    const beforeB = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, b),
    );
    expect(beforeA.status).toBe(200);
    expect(beforeB.status).toBe(200);

    const killed = await logoutAll(
      jsonRequest("http://localhost/api/auth/logout-all", "POST", undefined, a),
    );
    expect(killed.status).toBe(200);
    const killedJson = (await killed.json()) as {
      ok?: boolean;
      token?: unknown;
      user?: unknown;
    };
    expect(killedJson.ok).toBe(true);
    expect(killedJson.token).toBeUndefined();
    expect(killedJson.user).toBeUndefined();

    const cookies = cookieHeader(killed);
    expect(cookies).toMatch(new RegExp(`${SESSION_COOKIE}=`));
    expect(cookies).toMatch(/Max-Age=0/i);

    const staleA = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, a),
    );
    const staleB = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, b),
    );
    expect(staleA.status).toBe(401);
    expect(staleB.status).toBe(401);

    const row = await db.user.findUnique({ where: { id: user.id } });
    expect(row?.tokenVersion).toBe(1);

    resetRateLimit(`login:${user.email}:local`);
    const relogin = await login(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        email: user.email,
        password: "password-ok",
      }),
    );
    expect(relogin.status).toBe(200);
    const reloginJson = (await relogin.json()) as { token?: string };
    expect(reloginJson.token).toBeTruthy();
    expect(reloginJson.token).not.toBe(a);
    expect(reloginJson.token).not.toBe(b);

    const fresh = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, reloginJson.token),
    );
    expect(fresh.status).toBe(200);
  });
});
