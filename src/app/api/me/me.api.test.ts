import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession, verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PROFILE_NAME_EMPTY,
  PROFILE_NAME_TOO_SHORT,
  PROFILE_NOTHING_TO_SAVE,
} from "@/lib/profile-copy";

import { GET as getMe, PATCH as patchMe } from "./route";
import { GET as getAuthMe } from "../auth/me/route";

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

describe.skipIf(SKIP_PG)("PATCH /api/me: display name, self only", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  async function seedUser(label: string, role: "client" | "admin" = "client") {
    const user = await db.user.create({
      data: {
        name: label,
        email: `me-${label}-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role,
      },
    });
    ids.push(user.id);
    const token = await signSession({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    return { user, token };
  }

  test("unauthenticated PATCH is 401", async () => {
    const res = await patchMe(
      jsonRequest("http://localhost/api/me", "PATCH", { name: "Анна" }),
    );
    expect(res.status).toBe(401);
  });

  test("empty name is 400 field error, not 200; GET still has old name", async () => {
    const { user, token } = await seedUser("empty");
    const empty = await patchMe(
      jsonRequest("http://localhost/api/me", "PATCH", { name: "   " }, token),
    );
    expect(empty.status).toBe(400);
    const emptyJson = (await empty.json()) as {
      error: string;
      fields?: { name?: string };
      user?: unknown;
    };
    expect(emptyJson.error).toBe(PROFILE_NAME_EMPTY);
    expect(emptyJson.fields?.name).toBe(PROFILE_NAME_EMPTY);
    expect(emptyJson.user).toBeUndefined();

    const short = await patchMe(
      jsonRequest("http://localhost/api/me", "PATCH", { name: "Я" }, token),
    );
    expect(short.status).toBe(400);
    const shortJson = (await short.json()) as { error: string };
    expect(shortJson.error).toBe(PROFILE_NAME_TOO_SHORT);

    const nothing = await patchMe(
      jsonRequest("http://localhost/api/me", "PATCH", {}, token),
    );
    expect(nothing.status).toBe(400);
    const nothingJson = (await nothing.json()) as { error: string };
    expect(nothingJson.error).toBe(PROFILE_NOTHING_TO_SAVE);

    const me = await getMe(
      jsonRequest("http://localhost/api/me", "GET", undefined, token),
    );
    expect(me.status).toBe(200);
    const meJson = (await me.json()) as { user: { name: string } };
    expect(meJson.user.name).toBe(user.name);
  });

  test("PATCH name updates DB, GET /api/auth/me, and session JWT; extra keys ignored", async () => {
    const { user, token } = await seedUser("rename", "client");
    const owner = await seedUser("other");

    const patched = await patchMe(
      jsonRequest(
        "http://localhost/api/me",
        "PATCH",
        {
          name: "  Мария  ",
          role: "admin",
          id: owner.user.id,
          userId: owner.user.id,
          email: "hijack@example.test",
          passwordHash: "nope",
        },
        token,
      ),
    );
    expect(patched.status).toBe(200);
    const patchedJson = (await patched.json()) as {
      user: {
        id: string;
        name: string;
        role: string;
        email: string;
      };
      token?: string;
    };
    expect(patchedJson.user.id).toBe(user.id);
    expect(patchedJson.user.name).toBe("Мария");
    expect(patchedJson.user.role).toBe("client");
    expect(patchedJson.user.email).toBe(user.email);
    expect(JSON.stringify(patchedJson)).not.toMatch(/password/i);
    expect(patchedJson.token).toBeTruthy();

    const row = await db.user.findUnique({ where: { id: user.id } });
    expect(row?.name).toBe("Мария");
    expect(row?.role).toBe("client");
    expect(row?.email).toBe(user.email);

    const other = await db.user.findUnique({ where: { id: owner.user.id } });
    expect(other?.name).toBe("other");

    const authMe = await getAuthMe(
      jsonRequest("http://localhost/api/auth/me", "GET", undefined, token),
    );
    expect(authMe.status).toBe(200);
    const authJson = (await authMe.json()) as { user: { name: string } };
    expect(authJson.user.name).toBe("Мария");

    const payload = await verifyToken(patchedJson.token!, "session");
    expect(payload?.sub).toBe(user.id);
    expect(payload?.name).toBe("Мария");
  });
});
