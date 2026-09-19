import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as adminStats } from "./stats/route";
import { GET as adminUsers } from "./users/route";
import { GET as adminAudit } from "./audit/route";
import { GET as adminProviders } from "./ai/providers/route";
import { GET as adminDefaults } from "./ai/defaults/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

function jsonRequest(url: string, bearer?: string): Request {
  const headers = new Headers({ accept: "application/json" });
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, { method: "GET", headers });
}

async function tokenFor(user: {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client";
}): Promise<string> {
  return signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

describe.skipIf(SKIP_PG)("admin stats / users / audit / AI providers", () => {
  afterAll(async () => {
    for (const id of ids) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("client token is 403 on stats, users, audit, and providers", async () => {
    const client = await db.user.create({
      data: {
        name: "Клиент",
        email: `admin-client-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(client.id);
    const token = await tokenFor(client);

    const stats = await adminStats(
      jsonRequest("http://localhost/api/admin/stats", token),
    );
    const users = await adminUsers(
      jsonRequest("http://localhost/api/admin/users", token),
    );
    const audit = await adminAudit(
      jsonRequest("http://localhost/api/admin/audit", token),
    );
    const providers = await adminProviders(
      jsonRequest("http://localhost/api/admin/ai/providers", token),
    );

    expect(stats.status).toBe(403);
    expect(users.status).toBe(403);
    expect(audit.status).toBe(403);
    expect(providers.status).toBe(403);
    const statsJson = (await stats.json()) as { stats?: unknown; error: string };
    expect(statsJson.stats).toBeUndefined();
    expect(statsJson.error).toMatch(/администратор/i);
  });

  test("admin sees 200 stats with 14-day series and workspace counts", async () => {
    const admin = await db.user.create({
      data: {
        name: "Админ",
        email: `admin-ok-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "admin",
      },
    });
    ids.push(admin.id);
    const idle = await db.user.create({
      data: {
        name: "Пустой",
        email: `admin-idle-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(idle.id);
    const token = await tokenFor(admin);

    const statsRes = await adminStats(
      jsonRequest("http://localhost/api/admin/stats", token),
    );
    expect(statsRes.status).toBe(200);
    const statsJson = (await statsRes.json()) as {
      stats: {
        users: number;
        workspaces: number;
        projects: number;
        activity: unknown[];
      };
    };
    expect(statsJson.stats.users).toBeGreaterThan(0);
    expect(statsJson.stats.workspaces).toBeGreaterThanOrEqual(0);
    expect(statsJson.stats.projects).toBeGreaterThanOrEqual(statsJson.stats.workspaces);
    expect(statsJson.stats.activity).toHaveLength(14);

    const usersRes = await adminUsers(
      jsonRequest("http://localhost/api/admin/users", token),
    );
    expect(usersRes.status).toBe(200);
    const usersJson = (await usersRes.json()) as {
      users: { id: string; lastActivity: string | null; counts: { notes: number } }[];
    };
    const idleRow = usersJson.users.find((u) => u.id === idle.id);
    expect(idleRow).toBeTruthy();
    expect(idleRow?.lastActivity).toBeNull();
    expect(idleRow?.counts.notes).toBe(0);

    const auditRes = await adminAudit(
      jsonRequest("http://localhost/api/admin/audit?limit=10", token),
    );
    expect(auditRes.status).toBe(200);
    const auditJson = (await auditRes.json()) as { entries: unknown[] };
    expect(Array.isArray(auditJson.entries)).toBe(true);

    const providersRes = await adminProviders(
      jsonRequest("http://localhost/api/admin/ai/providers", token),
    );
    expect(providersRes.status).toBe(200);
    const providersJson = (await providersRes.json()) as { providers: unknown[] };
    expect(Array.isArray(providersJson.providers)).toBe(true);

    const defaultsRes = await adminDefaults(
      jsonRequest("http://localhost/api/admin/ai/defaults", token),
    );
    expect(defaultsRes.status).toBe(200);
    const defaultsJson = (await defaultsRes.json()) as { defaults: unknown[] };
    expect(Array.isArray(defaultsJson.defaults)).toBe(true);
  });
});
