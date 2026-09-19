import { afterAll, describe, expect, test } from "bun:test";

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as getMe } from "@/app/api/me/route";
import { hashPassword, sessionCookieSecure } from "@/lib/auth";
import { SESSION_COOKIE } from "@/lib/auth-shared";
import { db } from "@/lib/db";
import { resetRateLimit } from "@/lib/rate-limit";

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

function setCookieLines(res: Response): string[] {
  return typeof res.headers.getSetCookie === "function"
    ? res.headers.getSetCookie()
    : (res.headers.get("set-cookie") ?? "").split("\n").filter(Boolean);
}

function cookieLine(res: Response, name: string): string {
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

describe.skipIf(SKIP_PG)("ps_session Set-Cookie flags", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("login sets httpOnly Lax cookie and still returns Bearer token", async () => {
    const user = await db.user.create({
      data: {
        name: "CookieFlags",
        email: `cookie-flags-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    resetRateLimit(`login:${user.email}:local`);

    const res = await login(
      jsonRequest("http://localhost/api/auth/login", "POST", {
        email: user.email,
        password: "password-ok",
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { token?: string };
    expect(json.token).toBeTruthy();

    expectSessionCookieFlags(cookieLine(res, SESSION_COOKIE), {
      secure: sessionCookieSecure(),
    });

    const viaBearer = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, json.token),
    );
    expect(viaBearer.status).toBe(200);
  });

  test("logout expires ps_session with the same flags", async () => {
    const res = await logout(
      jsonRequest("http://localhost/api/auth/logout", "POST"),
    );
    expect(res.status).toBe(200);
    expectSessionCookieFlags(cookieLine(res, SESSION_COOKIE), {
      expired: true,
      secure: sessionCookieSecure(),
    });
  });
});
