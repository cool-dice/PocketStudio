import { afterAll, describe, expect, test } from "bun:test";

import { hashPassword, signSession } from "@/lib/auth";
import { db } from "@/lib/db";

import { POST as register } from "./auth/register/route";
import { GET as peekInvite } from "./invites/[token]/route";
import { GET as listInvites, POST as createInvite } from "./admin/invites/route";
import { POST as createOffer } from "./offers/route";
import { PATCH as patchOffer } from "./offers/[id]/route";
import { GET as listPayouts, PATCH as patchPayout } from "./payouts/route";
import { POST as markOfferPaid } from "./admin/offers/[id]/paid/route";
import { GET as listAdminOffers } from "./admin/offers/route";
import { GET as listAdminPayouts } from "./admin/payouts/route";

const SKIP_PG = !(process.env.DATABASE_URL ?? "").startsWith("postgres");
const stamp = Date.now().toString(36);
const ids: string[] = [];

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

async function tokenFor(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): Promise<string> {
  return signSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "admin" ? "admin" : "client",
  });
}

describe.skipIf(SKIP_PG)("invites + payouts API", () => {
  afterAll(async () => {
    for (const id of ids.reverse()) {
      await db.user.delete({ where: { id } }).catch(() => {});
    }
  });

  test("admin invite: peek, register assigns role, reuse and expiry copy", async () => {
    const admin = await db.user.create({
      data: {
        name: "Инвайтер",
        email: `inv-admin-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "admin",
      },
    });
    ids.push(admin.id);
    const adminToken = await tokenFor(admin);

    const created = await createInvite(
      jsonRequest(
        "http://localhost/api/admin/invites",
        "POST",
        { email: `guest-admin-${stamp}@example.test`, role: "admin" },
        adminToken,
      ),
    );
    expect(created.status).toBe(201);
    const createdJson = (await created.json()) as {
      invite: { token: string; role: string; email: string };
    };
    expect(createdJson.invite.role).toBe("admin");
    expect(createdJson.invite.token.length).toBeGreaterThan(8);

    const listed = await listInvites(
      jsonRequest("http://localhost/api/admin/invites", "GET", undefined, adminToken),
    );
    expect(listed.status).toBe(200);
    const listedJson = (await listed.json()) as {
      invites: { token: string; expiresAt: string | null }[];
    };
    expect(listedJson.invites.some((i) => i.token === createdJson.invite.token)).toBe(
      true,
    );
    expect(listedJson.invites[0]?.expiresAt).toBeTruthy();

    const peekOk = await peekInvite(
      jsonRequest(
        `http://localhost/api/invites/${createdJson.invite.token}`,
        "GET",
      ),
      { params: Promise.resolve({ token: createdJson.invite.token }) },
    );
    expect(peekOk.status).toBe(200);
    const peekOkJson = (await peekOk.json()) as {
      status: string;
      role: string;
      email: string;
    };
    expect(peekOkJson.status).toBe("ok");
    expect(peekOkJson.role).toBe("admin");
    expect(peekOkJson.email).toBe(createdJson.invite.email);

    const registered = await register(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        name: "Гость-админ",
        email: createdJson.invite.email,
        password: "password-ok",
        invite: createdJson.invite.token,
      }),
    );
    expect(registered.status).toBe(201);
    const registeredJson = (await registered.json()) as {
      user: { id: string; role: string };
    };
    ids.push(registeredJson.user.id);
    expect(registeredJson.user.role).toBe("admin");

    const reused = await register(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        name: "Другой",
        email: `other-inv-${stamp}@example.test`,
        password: "password-ok",
        invite: createdJson.invite.token,
      }),
    );
    expect(reused.status).toBe(400);
    const reusedJson = (await reused.json()) as { error: string };
    expect(reusedJson.error).toMatch(/использован/i);
    expect(reusedJson.error).not.toMatch(/успеш/i);

    const peekUsed = await peekInvite(
      jsonRequest(
        `http://localhost/api/invites/${createdJson.invite.token}`,
        "GET",
      ),
      { params: Promise.resolve({ token: createdJson.invite.token }) },
    );
    const peekUsedJson = (await peekUsed.json()) as { status: string };
    expect(peekUsedJson.status).toBe("used");

    const expired = await db.invite.create({
      data: {
        email: `expired-${stamp}@example.test`,
        role: "client",
        token: `expired${stamp}abcdefgh`,
        createdBy: admin.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const expiredReg = await register(
      jsonRequest("http://localhost/api/auth/register", "POST", {
        name: "Опоздал",
        email: expired.email,
        password: "password-ok",
        invite: expired.token,
      }),
    );
    expect(expiredReg.status).toBe(400);
    const expiredJson = (await expiredReg.json()) as { error: string };
    expect(expiredJson.error).toMatch(/истёк/i);

    const peekExp = await peekInvite(
      jsonRequest(`http://localhost/api/invites/${expired.token}`, "GET"),
      { params: Promise.resolve({ token: expired.token }) },
    );
    const peekExpJson = (await peekExp.json()) as { status: string };
    expect(peekExpJson.status).toBe("expired");
  });

  test("client cannot create invites, mark offers paid, or patch payouts", async () => {
    const client = await db.user.create({
      data: {
        name: "Клиент",
        email: `pay-client-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "client",
      },
    });
    ids.push(client.id);
    const admin = await db.user.create({
      data: {
        name: "Кассир",
        email: `pay-admin-${stamp}@example.test`,
        passwordHash: await hashPassword("password-ok"),
        role: "admin",
      },
    });
    ids.push(admin.id);
    const clientToken = await tokenFor(client);
    const adminToken = await tokenFor(admin);

    const forbiddenInvite = await createInvite(
      jsonRequest(
        "http://localhost/api/admin/invites",
        "POST",
        { email: `nope-${stamp}@example.test`, role: "admin" },
        clientToken,
      ),
    );
    expect(forbiddenInvite.status).toBe(403);

    const project = await db.project.create({
      data: { userId: client.id, name: "Кабинет", type: "book" },
    });
    const offerRes = await createOffer(
      jsonRequest(
        "http://localhost/api/offers",
        "POST",
        {
          projectId: project.id,
          title: "Глава",
          priceCents: 25000,
          paymentMode: "simulated",
        },
        clientToken,
      ),
    );
    expect(offerRes.status).toBe(201);
    const offerJson = (await offerRes.json()) as { offer: { id: string } };

    const clientMark = await markOfferPaid(
      jsonRequest(
        `http://localhost/api/admin/offers/${offerJson.offer.id}/paid`,
        "POST",
        {},
        clientToken,
      ),
      { params: Promise.resolve({ id: offerJson.offer.id }) },
    );
    expect(clientMark.status).toBe(403);

    const liveOfferRes = await createOffer(
      jsonRequest(
        "http://localhost/api/offers",
        "POST",
        {
          projectId: project.id,
          title: "Live",
          priceCents: 1000,
          paymentMode: "live",
        },
        clientToken,
      ),
    );
    expect(liveOfferRes.status).toBe(201);
    const liveOffer = (await liveOfferRes.json()) as { offer: { id: string } };
    const liveCheckout = await patchOffer(
      jsonRequest(
        `http://localhost/api/offers/${liveOffer.offer.id}`,
        "PATCH",
        { checkout: true },
        clientToken,
      ),
      { params: Promise.resolve({ id: liveOffer.offer.id }) },
    );
    expect(liveCheckout.status).toBe(400);
    const liveJson = (await liveCheckout.json()) as { error: string; offer?: { status: string } };
    expect(liveJson.error).toMatch(/ключ|админ|не подключ|не настроен/i);
    const stillLive = await db.offer.findUnique({ where: { id: liveOffer.offer.id } });
    expect(stillLive?.status).not.toBe("paid");

    const paid = await markOfferPaid(
      jsonRequest(
        `http://localhost/api/admin/offers/${offerJson.offer.id}/paid`,
        "POST",
        {},
        adminToken,
      ),
      { params: Promise.resolve({ id: offerJson.offer.id }) },
    );
    expect(paid.status).toBe(200);
    const paidJson = (await paid.json()) as { offer: { status: string } };
    expect(paidJson.offer.status).toBe("paid");

    const again = await markOfferPaid(
      jsonRequest(
        `http://localhost/api/admin/offers/${offerJson.offer.id}/paid`,
        "POST",
        {},
        adminToken,
      ),
      { params: Promise.resolve({ id: offerJson.offer.id }) },
    );
    expect(again.status).toBe(409);

    const payouts = await listPayouts(
      jsonRequest("http://localhost/api/payouts", "GET", undefined, clientToken),
    );
    expect(payouts.status).toBe(200);
    const payoutsJson = (await payouts.json()) as {
      payouts: { id: string; status: string; amountCents: number }[];
      totalPendingCents: number;
    };
    expect(payoutsJson.payouts).toHaveLength(1);
    expect(payoutsJson.payouts[0]?.status).toBe("pending");
    expect(payoutsJson.totalPendingCents).toBe(25000);

    const clientPatch = await patchPayout(
      jsonRequest(
        "http://localhost/api/payouts",
        "PATCH",
        { id: payoutsJson.payouts[0]?.id, status: "paid" },
        clientToken,
      ),
    );
    expect(clientPatch.status).toBe(403);
    const stillPending = await db.payout.findUnique({
      where: { id: payoutsJson.payouts[0]!.id },
    });
    expect(stillPending?.status).toBe("pending");

    const adminList = await listAdminOffers(
      jsonRequest("http://localhost/api/admin/offers", "GET", undefined, adminToken),
    );
    expect(adminList.status).toBe(200);
    const adminListJson = (await adminList.json()) as {
      offers: { id: string; status: string }[];
    };
    expect(adminListJson.offers.some((o) => o.id === offerJson.offer.id)).toBe(true);

    const clientAdminPayouts = await listAdminPayouts(
      jsonRequest("http://localhost/api/admin/payouts", "GET", undefined, clientToken),
    );
    expect(clientAdminPayouts.status).toBe(403);

    const adminPayouts = await listAdminPayouts(
      jsonRequest("http://localhost/api/admin/payouts", "GET", undefined, adminToken),
    );
    expect(adminPayouts.status).toBe(200);
    const adminPayoutsJson = (await adminPayouts.json()) as {
      payouts: { id: string; status: string; userEmail: string }[];
    };
    expect(
      adminPayoutsJson.payouts.some((p) => p.id === payoutsJson.payouts[0]?.id),
    ).toBe(true);

    const badStatus = await patchPayout(
      jsonRequest(
        "http://localhost/api/payouts",
        "PATCH",
        { id: payoutsJson.payouts[0]?.id, status: "wired" },
        adminToken,
      ),
    );
    expect(badStatus.status).toBe(400);

    const missing = await patchPayout(
      jsonRequest(
        "http://localhost/api/payouts",
        "PATCH",
        { id: "missing-payout-id", status: "paid" },
        adminToken,
      ),
    );
    expect(missing.status).toBe(404);

    const adminPaid = await patchPayout(
      jsonRequest(
        "http://localhost/api/payouts",
        "PATCH",
        { id: payoutsJson.payouts[0]?.id, status: "paid" },
        adminToken,
      ),
    );
    expect(adminPaid.status).toBe(200);
    const paidPayout = (await adminPaid.json()) as {
      payout: { status: string };
      hint: string;
    };
    expect(paidPayout.payout.status).toBe("paid");
    expect(paidPayout.hint).toMatch(/не выполнялся/i);

    const failedPayout = await db.payout.create({
      data: {
        userId: client.id,
        amountCents: 1000,
        status: "pending",
      },
    });
    const adminFailed = await patchPayout(
      jsonRequest(
        "http://localhost/api/payouts",
        "PATCH",
        { id: failedPayout.id, status: "failed" },
        adminToken,
      ),
    );
    expect(adminFailed.status).toBe(200);
    const failedJson = (await adminFailed.json()) as { payout: { status: string } };
    expect(failedJson.payout.status).toBe("failed");
  });
});
