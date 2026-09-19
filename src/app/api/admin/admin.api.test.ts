import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { lockAndCountAdmins, remainingAdminsAfterDemote } from "@/lib/admin-role-lock";
import {
  LAST_ADMIN_DEMOTE,
  SELF_ROLE_CHANGE,
} from "@/lib/admin-users-copy";

import { GET as adminStats } from "./stats/route";
import { GET as adminUsers } from "./users/route";
import {
  DELETE as adminDeleteUser,
  PATCH as adminPatchUser,
} from "./users/[id]/route";
import { GET as adminAudit } from "./audit/route";
import { GET as adminProviders } from "./ai/providers/route";
import { GET as adminDefaults } from "./ai/defaults/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

function jsonRequest(
  url: string,
  bearer?: string,
  init?: { method?: string; body?: unknown },
): Request {
  const headers = new Headers({ accept: "application/json" });
  if (init?.body !== undefined) headers.set("content-type", "application/json");
  if (bearer) headers.set("authorization", `Bearer ${bearer}`);
  return new Request(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
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
    await db.auditLog.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
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
    const usersJson = (await users.json()) as {
      users?: unknown;
      hasMore?: unknown;
      error: string;
    };
    expect(usersJson.users).toBeUndefined();
    expect(usersJson.hasMore).toBeUndefined();
    expect(usersJson.error).toMatch(/администратор/i);
    expect(JSON.stringify(usersJson)).not.toMatch(/passwordHash|\$2[aby]\$/i);
    const auditJson = (await audit.json()) as {
      entries?: unknown;
      hasMore?: unknown;
      error: string;
    };
    expect(auditJson.entries).toBeUndefined();
    expect(auditJson.hasMore).toBeUndefined();
    expect(auditJson.error).toMatch(/администратор/i);
    expect(JSON.stringify(auditJson)).not.toMatch(/"meta"/);
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
      hasMore: boolean;
    };
    expect(JSON.stringify(usersJson)).not.toMatch(/passwordHash|\$2[aby]\$/i);
    expect(usersJson.hasMore).toBe(false);
    expect(usersJson.users.length).toBeLessThanOrEqual(500);
    for (const row of usersJson.users) {
      expect(row).not.toHaveProperty("passwordHash");
    }
    const idleRow = usersJson.users.find((u) => u.id === idle.id);
    expect(idleRow).toBeTruthy();
    expect(idleRow?.lastActivity).toBeNull();
    expect(idleRow?.counts.notes).toBe(0);

    const auditRes = await adminAudit(
      jsonRequest("http://localhost/api/admin/audit?limit=10", token),
    );
    expect(auditRes.status).toBe(200);
    const auditJson = (await auditRes.json()) as {
      entries: Record<string, unknown>[];
      hasMore: boolean;
    };
    expect(Array.isArray(auditJson.entries)).toBe(true);
    expect(typeof auditJson.hasMore).toBe("boolean");
    for (const row of auditJson.entries) {
      expect(row).not.toHaveProperty("meta");
      expect(row).not.toHaveProperty("apiKey");
    }

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

  test("audit list redacts secrets, paginates, and 400s bad offset", async () => {
    const admin = await db.user.create({
      data: {
        name: "Админ журнал",
        email: `admin-audit-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "admin",
      },
    });
    ids.push(admin.id);
    const token = await tokenFor(admin);
    const leak = "sk-test-LEAKMEAUDITKEY99";
    const created: string[] = [];
    for (let i = 0; i < 2; i++) {
      created.push(
        (
          await db.auditLog.create({
            data: {
              userId: admin.id,
              action: `test.audit.page.${stamp}.${i}`,
              entity: "user",
              entityId: admin.id,
            },
          })
        ).id,
      );
    }
    const leakRow = await db.auditLog.create({
      data: {
        userId: admin.id,
        action: "admin.ai.provider.create",
        entity: "aiProvider",
        entityId: leak,
        meta: JSON.stringify({ apiKey: leak, token: "Bearer leakedtoken99" }),
      },
    });
    created.push(leakRow.id);

    try {
      const page1 = await adminAudit(
        jsonRequest("http://localhost/api/admin/audit?limit=1", token),
      );
      expect(page1.status).toBe(200);
      const json1 = (await page1.json()) as {
        entries: Record<string, unknown>[];
        hasMore: boolean;
      };
      expect(json1.entries).toHaveLength(1);
      expect(json1.hasMore).toBe(true);

      const page2 = await adminAudit(
        jsonRequest("http://localhost/api/admin/audit?limit=1&offset=1", token),
      );
      expect(page2.status).toBe(200);
      const json2 = (await page2.json()) as { entries: { id: string }[] };
      expect(json2.entries[0]?.id).not.toBe(json1.entries[0]?.id);

      const wide = await adminAudit(
        jsonRequest("http://localhost/api/admin/audit?limit=200", token),
      );
      expect(wide.status).toBe(200);
      const jsonWide = (await wide.json()) as {
        entries: { id: string; entityId: string | null }[];
        hasMore: boolean;
      };
      const leaked = jsonWide.entries.find((e) => e.id === leakRow.id);
      expect(leaked).toBeTruthy();
      expect(leaked?.entityId).toBe("[redacted]");
      const blob = JSON.stringify(jsonWide);
      expect(blob).not.toContain(leak);
      expect(blob).not.toMatch(/"meta"/);
      expect(blob).not.toMatch(/apiKey/);
      for (const row of jsonWide.entries) {
        expect(row).not.toHaveProperty("meta");
      }

      const bad = await adminAudit(
        jsonRequest("http://localhost/api/admin/audit?offset=-1", token),
      );
      expect(bad.status).toBe(400);
    } finally {
      await db.auditLog.deleteMany({ where: { id: { in: created } } }).catch(() => {});
    }
  });

  test("role change: 403 for client, last admin stays, peer demote has no hash", async () => {
    const passwordHash = await hashPassword("password-ok");
    const adminA = await db.user.create({
      data: {
        name: "Админ А",
        email: `admin-role-a-${stamp}@example.test`,
        passwordHash,
        role: "admin",
      },
    });
    ids.push(adminA.id);
    const adminB = await db.user.create({
      data: {
        name: "Админ Б",
        email: `admin-role-b-${stamp}@example.test`,
        passwordHash,
        role: "admin",
      },
    });
    ids.push(adminB.id);
    const client = await db.user.create({
      data: {
        name: "Клиент роль",
        email: `admin-role-c-${stamp}@example.test`,
        passwordHash,
        role: "client",
      },
    });
    ids.push(client.id);

    const clientToken = await tokenFor(client);
    const clientPatch = await adminPatchUser(
      jsonRequest(`http://localhost/api/admin/users/${adminA.id}`, clientToken, {
        method: "PATCH",
        body: { role: "client" },
      }),
      { params: Promise.resolve({ id: adminA.id }) },
    );
    expect(clientPatch.status).toBe(403);
    const clientJson = (await clientPatch.json()) as {
      user?: unknown;
      error: string;
    };
    expect(clientJson.user).toBeUndefined();
    expect(clientJson.error).toMatch(/администратор/i);
    expect(JSON.stringify(clientJson)).not.toMatch(/passwordHash|\$2[aby]\$/i);

    const clientDelete = await adminDeleteUser(
      jsonRequest(`http://localhost/api/admin/users/${adminA.id}`, clientToken, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: adminA.id }) },
    );
    expect(clientDelete.status).toBe(403);

    const tokenA = await tokenFor(adminA);
    const demoteB = await adminPatchUser(
      jsonRequest(`http://localhost/api/admin/users/${adminB.id}`, tokenA, {
        method: "PATCH",
        body: { role: "client" },
      }),
      { params: Promise.resolve({ id: adminB.id }) },
    );
    expect(demoteB.status).toBe(200);
    const demoteJson = (await demoteB.json()) as {
      user: { id: string; role: string };
    };
    expect(demoteJson.user.id).toBe(adminB.id);
    expect(demoteJson.user.role).toBe("client");
    expect(demoteJson.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(demoteJson)).not.toMatch(/passwordHash|\$2[aby]\$/i);
    expect(JSON.stringify(demoteJson)).not.toContain(passwordHash);

    const stillB = await db.user.findUnique({
      where: { id: adminB.id },
      select: { role: true, passwordHash: true },
    });
    expect(stillB?.role).toBe("client");
    expect(stillB?.passwordHash).toBe(passwordHash);

    const otherAdmins = await db.user.count({
      where: { role: "admin", id: { not: adminA.id } },
    });
    const lastSelf = await adminPatchUser(
      jsonRequest(`http://localhost/api/admin/users/${adminA.id}`, tokenA, {
        method: "PATCH",
        body: { role: "client" },
      }),
      { params: Promise.resolve({ id: adminA.id }) },
    );
    expect(lastSelf.status).toBe(409);
    const lastJson = (await lastSelf.json()) as { user?: unknown; error: string };
    expect(lastJson.user).toBeUndefined();
    expect(lastJson.error).toBe(
      otherAdmins === 0 ? LAST_ADMIN_DEMOTE : SELF_ROLE_CHANGE,
    );
    const stillA = await db.user.findUnique({
      where: { id: adminA.id },
      select: { role: true },
    });
    expect(stillA?.role).toBe("admin");

    const promoteB = await adminPatchUser(
      jsonRequest(`http://localhost/api/admin/users/${adminB.id}`, tokenA, {
        method: "PATCH",
        body: { role: "admin" },
      }),
      { params: Promise.resolve({ id: adminB.id }) },
    );
    expect(promoteB.status).toBe(200);

    const selfWithPeer = await adminPatchUser(
      jsonRequest(`http://localhost/api/admin/users/${adminA.id}`, tokenA, {
        method: "PATCH",
        body: { role: "client" },
      }),
      { params: Promise.resolve({ id: adminA.id }) },
    );
    expect(selfWithPeer.status).toBe(409);
    const selfJson = (await selfWithPeer.json()) as { error: string };
    expect(selfJson.error).toBe(SELF_ROLE_CHANGE);
    expect(
      (await db.user.findUnique({ where: { id: adminA.id }, select: { role: true } }))
        ?.role,
    ).toBe("admin");
  });

  test("sequential last-two demotes: second is 409 and unique admin count stays >= 1", async () => {
    const passwordHash = await hashPassword("password-ok");
    const adminA = await db.user.create({
      data: {
        name: "Админ lock A",
        email: `admin-lock-a-${stamp}@example.test`,
        passwordHash,
        role: "admin",
      },
    });
    ids.push(adminA.id);
    const adminB = await db.user.create({
      data: {
        name: "Админ lock B",
        email: `admin-lock-b-${stamp}@example.test`,
        passwordHash,
        role: "admin",
      },
    });
    ids.push(adminB.id);

    const tokenA = await tokenFor(adminA);
    const before = await db.$transaction((tx) => lockAndCountAdmins(tx));
    expect(before).toBeGreaterThanOrEqual(2);

    const first = await adminPatchUser(
      jsonRequest(`http://localhost/api/admin/users/${adminB.id}`, tokenA, {
        method: "PATCH",
        body: { role: "client" },
      }),
      { params: Promise.resolve({ id: adminB.id }) },
    );
    expect(first.status).toBe(200);

    const afterFirst = await db.$transaction((tx) => lockAndCountAdmins(tx));
    expect(afterFirst).toBe(remainingAdminsAfterDemote(before));
    expect(afterFirst).toBeGreaterThanOrEqual(1);
    expect(
      (await db.user.findUnique({ where: { id: adminB.id }, select: { role: true } }))
        ?.role,
    ).toBe("client");

    const extras = afterFirst - 1; // admins besides A
    const second = await adminPatchUser(
      jsonRequest(`http://localhost/api/admin/users/${adminA.id}`, tokenA, {
        method: "PATCH",
        body: { role: "client" },
      }),
      { params: Promise.resolve({ id: adminA.id }) },
    );
    expect(second.status).toBe(409);
    const secondJson = (await second.json()) as { user?: unknown; error: string };
    expect(secondJson.user).toBeUndefined();
    expect(secondJson.error).toBe(
      extras === 0 ? LAST_ADMIN_DEMOTE : SELF_ROLE_CHANGE,
    );
    expect(
      (await db.user.findUnique({ where: { id: adminA.id }, select: { role: true } }))
        ?.role,
    ).toBe("admin");

    const afterSecond = await db.$transaction((tx) => lockAndCountAdmins(tx));
    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond).toBeGreaterThanOrEqual(1);
  });

  test("parallel peer demotes cannot leave zero admins", async () => {
    const passwordHash = await hashPassword("password-ok");
    const adminA = await db.user.create({
      data: {
        name: "Админ race A",
        email: `admin-race-a-${stamp}@example.test`,
        passwordHash,
        role: "admin",
      },
    });
    ids.push(adminA.id);
    const adminB = await db.user.create({
      data: {
        name: "Админ race B",
        email: `admin-race-b-${stamp}@example.test`,
        passwordHash,
        role: "admin",
      },
    });
    ids.push(adminB.id);

    const tokenA = await tokenFor(adminA);
    const tokenB = await tokenFor(adminB);
    const others = await db.user.count({
      where: { role: "admin", id: { notIn: [adminA.id, adminB.id] } },
    });

    const [r1, r2] = await Promise.all([
      adminPatchUser(
        jsonRequest(`http://localhost/api/admin/users/${adminB.id}`, tokenA, {
          method: "PATCH",
          body: { role: "client" },
        }),
        { params: Promise.resolve({ id: adminB.id }) },
      ),
      adminPatchUser(
        jsonRequest(`http://localhost/api/admin/users/${adminA.id}`, tokenB, {
          method: "PATCH",
          body: { role: "client" },
        }),
        { params: Promise.resolve({ id: adminA.id }) },
      ),
    ]);

    const remaining = await db.$transaction((tx) => lockAndCountAdmins(tx));
    expect(remaining).toBeGreaterThanOrEqual(1);

    const pairAdmins = await db.user.count({
      where: { role: "admin", id: { in: [adminA.id, adminB.id] } },
    });
    if (others === 0) {
      expect(pairAdmins).toBe(1);
      const statuses = [r1.status, r2.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);
      const winner = r1.status === 200 ? r1 : r2;
      const loser = r1.status === 409 ? r1 : r2;
      const winnerJson = (await winner.json()) as { user: { role: string } };
      expect(winnerJson.user.role).toBe("client");
      const loserJson = (await loser.json()) as { error: string };
      expect(loserJson.error).toBe(LAST_ADMIN_DEMOTE);
    } else {
      expect(remaining).toBeGreaterThanOrEqual(others);
    }
  });
});
