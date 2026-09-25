import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as getOnboarding, PATCH as patchOnboarding } from "./route";
import { GET as getAuthMe } from "../../auth/me/route";

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

describe.skipIf(SKIP_PG)("/api/me/onboarding persists skip", () => {
  const ids: string[] = [];

  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("GET starts false; PATCH true survives GET and /api/auth/me", async () => {
    const user = await db.user.create({
      data: {
        name: "Onboard",
        email: `onboard-${stamp}@example.test`,
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

    const first = await getOnboarding(
      jsonRequest("http://localhost/api/me/onboarding", "GET", undefined, token),
    );
    expect(first.status).toBe(200);
    const firstJson = (await first.json()) as { onboardingDone: boolean };
    expect(firstJson.onboardingDone).toBe(false);

    const patched = await patchOnboarding(
      jsonRequest(
        "http://localhost/api/me/onboarding",
        "PATCH",
        { onboardingDone: true },
        token,
      ),
    );
    expect(patched.status).toBe(200);

    const again = await getOnboarding(
      jsonRequest("http://localhost/api/me/onboarding", "GET", undefined, token),
    );
    const againJson = (await again.json()) as { onboardingDone: boolean };
    expect(againJson.onboardingDone).toBe(true);

    const me = await getAuthMe(
      jsonRequest("http://localhost/api/auth/me", "GET", undefined, token),
    );
    expect(me.status).toBe(200);
    const meJson = (await me.json()) as { user: { onboardingDone?: boolean } };
    expect(meJson.user.onboardingDone).toBe(true);
  });

  test("unauthenticated GET/PATCH are 401", async () => {
    const get = await getOnboarding(
      jsonRequest("http://localhost/api/me/onboarding", "GET"),
    );
    expect(get.status).toBe(401);
    const patch = await patchOnboarding(
      jsonRequest("http://localhost/api/me/onboarding", "PATCH", {
        onboardingDone: true,
      }),
    );
    expect(patch.status).toBe(401);
  });
});
