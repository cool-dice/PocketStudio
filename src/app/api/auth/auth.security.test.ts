import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { resetRateLimit } from "@/lib/rate-limit";

import { POST as login } from "./login/route";
import { POST as register } from "./register/route";
import { GET as adminStats } from "../admin/stats/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);

function jsonRequest(
  url: string,
  method: string,
  body?: unknown,
  bearer?: string,
  extraHeaders?: Record<string, string>,
): Request {
  const headers = new Headers({ accept: "application/json", ...extraHeaders });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(SKIP_PG)("auth security: rate limit, invite, admin", () => {
  const ids: string[] = [];

  test("login is rate-limited after repeated failures", async () => {
    const email = `rate-${stamp}@example.test`;
    const user = await db.user.create({
      data: {
        name: "Rate",
        email,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);
    resetRateLimit(`login:${email}:local`);

    let lastStatus = 0;
    for (let i = 0; i < 9; i++) {
      const res = await login(
        jsonRequest("http://localhost/api/auth/login", "POST", {
          email,
          password: "wrong-password",
        }),
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });

  test("register is rate-limited after repeated attempts from the same IP", async () => {
    const ip = "203.0.113.81";
    const email = `reg-rate-${stamp}@example.test`;
    resetRateLimit(`register:${ip}`);

    let lastStatus = 0;
    let lastError = "";
    let lastRetryAfter = "";
    for (let i = 0; i < 9; i++) {
      const res = await register(
        jsonRequest(
          "http://localhost/api/auth/register",
          "POST",
          {
            name: "Рег",
            email,
            password: "password-ok",
          },
          undefined,
          { "x-forwarded-for": ip },
        ),
      );
      lastStatus = res.status;
      lastRetryAfter = res.headers.get("retry-after") ?? "";
      const json = (await res.json()) as { error?: string; user?: { id: string } };
      lastError = json.error ?? "";
      if (json.user?.id) ids.push(json.user.id);
    }
    expect(lastStatus).toBe(429);
    expect(lastError).toMatch(/регистрац/i);
    expect(lastError).toMatch(/[А-Яа-яЁё]/);
    expect(Number(lastRetryAfter)).toBeGreaterThan(0);
  });

  test("invite token cannot be reused after a successful register", async () => {
    const admin = await db.user.create({
      data: {
        name: "Inviter",
        email: `inviter-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "admin",
      },
    });
    ids.push(admin.id);
    resetRateLimit("register:local");
    const invite = await db.invite.create({
      data: {
        email: `guest-${stamp}@example.test`,
        role: "client",
        token: `tok${stamp}abcdefgh`,
        createdBy: admin.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const first = await register(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        name: "Гость",
        email: invite.email,
        password: "password-ok",
        invite: invite.token,
      }),
    );
    expect(first.status).toBe(201);
    const firstJson = (await first.json()) as { user: { id: string } };
    ids.push(firstJson.user.id);

    const reused = await db.invite.findUnique({ where: { id: invite.id } });
    expect(reused?.usedAt).toBeTruthy();

    const second = await register(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        name: "Другой",
        email: `other-${stamp}@example.test`,
        password: "password-ok",
        invite: invite.token,
      }),
    );
    expect(second.status).toBe(400);
    const secondJson = (await second.json()) as { error: string };
    expect(secondJson.error).toMatch(/использован/i);
  });

  test("client token cannot read admin stats", async () => {
    const client = await db.user.create({
      data: {
        name: "Client",
        email: `client-admin-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(client.id);
    const token = await signSession({
      sub: client.id,
      email: client.email,
      name: client.name,
      role: client.role,
    });
    const res = await adminStats(
      jsonRequest("http://localhost/api/admin/stats", "GET", undefined, token),
    );
    expect(res.status).toBe(403);
    const json = (await res.json()) as { stats?: unknown; error: string };
    expect(json.stats).toBeUndefined();
    expect(json.error).toMatch(/администратор/i);
  });

  afterAll(async () => {
    for (const id of ids) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });
});
