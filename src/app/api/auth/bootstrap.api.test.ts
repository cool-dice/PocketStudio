import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword } from "@/lib/auth";
import {
  firstUserBecomesAdmin,
  firstUserBecomesAdminFromState,
} from "@/lib/auth-bootstrap";
import { db } from "@/lib/db";
import { adminSeedConfigured } from "@/lib/seed";

import { GET as bootstrap } from "./bootstrap/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

describe.skipIf(SKIP_PG)("GET /api/auth/bootstrap", () => {
  test("public JSON has only firstUserBecomesAdmin, no secrets", async () => {
    const res = await bootstrap();
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(json)).toEqual(["firstUserBecomesAdmin"]);
    expect(typeof json.firstUserBecomesAdmin).toBe("boolean");
    const blob = JSON.stringify(json);
    expect(blob).not.toMatch(/ADMIN_EMAIL|ADMIN_PASSWORD|passwordHash/i);
    expect(blob).not.toMatch(/@/);
    expect(json.firstUserBecomesAdmin).toBe(await firstUserBecomesAdmin());
  });

  test("empty DB → true; after a user exists → false", async () => {
    expect(firstUserBecomesAdminFromState(0, false)).toBe(true);
    expect(firstUserBecomesAdminFromState(1, false)).toBe(false);

    const before = await db.user.count();
    const seed = adminSeedConfigured();

    if (before === 0) {
      const empty = await bootstrap();
      const emptyJson = (await empty.json()) as {
        firstUserBecomesAdmin: boolean;
      };
      // Seed env creates the admin before register() counts, so the public
      // flag is false even on an empty table when ADMIN_EMAIL is configured.
      expect(emptyJson.firstUserBecomesAdmin).toBe(!seed);
    }

    const user = await db.user.create({
      data: {
        name: "Bootstrap",
        email: `bootstrap-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(user.id);

    const after = await bootstrap();
    const afterJson = (await after.json()) as { firstUserBecomesAdmin: boolean };
    expect(afterJson.firstUserBecomesAdmin).toBe(false);
  });

  afterAll(async () => {
    for (const id of ids) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });
});
