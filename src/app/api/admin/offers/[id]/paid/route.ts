import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { chargeOffer } from "@/lib/payments";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const schema = z.object({ note: z.string().trim().max(200).optional() });
  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  schema.safeParse(jsonRead.value);

  const offer = await db.offer.findUnique({ where: { id } });
  if (!offer) {
    return NextResponse.json({ error: "Оффер не найден" }, { status: 404 });
  }
  if (offer.status === "paid") {
    return NextResponse.json(
      { error: "Оффер уже отмечен оплаченным" },
      { status: 409 },
    );
  }
  const charged = await chargeOffer({
    offerId: offer.id,
    amountCents: offer.priceCents,
    currency: offer.currency,
    mode: "simulated",
  });
  const paid = await db.offer.update({
    where: { id: offer.id },
    data: {
      status: "paid",
      providerRef: charged.providerRef,
      paidAt: new Date(),
    },
  });
  await db.payout.create({
    data: {
      userId: offer.userId,
      amountCents: offer.priceCents,
      currency: offer.currency,
      status: "pending",
      providerRef: charged.providerRef,
      note: `Админ отметил оплату «${offer.title}»`,
    },
  });
  return NextResponse.json({
    offer: {
      id: paid.id,
      status: paid.status,
      paidAt: paid.paidAt?.toISOString() ?? null,
    },
  });
}
