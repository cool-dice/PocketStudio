import { NextResponse } from "next/server";
import { z } from "zod";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { chargeOffer } from "@/lib/payments";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;
  const schema = z.object({
    status: z.enum(["draft", "listed", "archived"]).optional(),
    title: z.string().trim().min(1).max(80).optional(),
    priceCents: z.number().int().min(0).max(10_000_000).optional(),
    checkout: z.boolean().optional(),
  });
  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = schema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const offer = await db.offer.findFirst({
    where: { id, userId: session.sub },
  });
  if (!offer) {
    return NextResponse.json({ error: "Оффер не найден" }, { status: 404 });
  }

  if (parsed.data.checkout) {
    if (offer.status === "paid") {
      return NextResponse.json({
        offer: {
          ...offer,
          paidAt: offer.paidAt?.toISOString() ?? null,
          createdAt: offer.createdAt.toISOString(),
        },
      });
    }
    const charged = await chargeOffer({
      offerId: offer.id,
      amountCents: offer.priceCents,
      currency: offer.currency,
      mode: offer.paymentMode === "live" ? "live" : "simulated",
    });
    if (!charged.ok) {
      return NextResponse.json({ error: charged.error }, { status: 400 });
    }
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
        userId: session.sub,
        amountCents: offer.priceCents,
        currency: offer.currency,
        status: "pending",
        providerRef: charged.providerRef,
        note: `Оффер «${offer.title}»`,
      },
    });
    return NextResponse.json({
      offer: {
        ...paid,
        paidAt: paid.paidAt?.toISOString() ?? null,
        createdAt: paid.createdAt.toISOString(),
      },
    });
  }

  const updated = await db.offer.update({
    where: { id: offer.id },
    data: {
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.priceCents !== undefined
        ? { priceCents: parsed.data.priceCents }
        : {}),
    },
  });
  return NextResponse.json({
    offer: {
      ...updated,
      paidAt: updated.paidAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}
