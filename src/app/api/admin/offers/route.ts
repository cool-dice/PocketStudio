import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const rows = await db.offer.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, name: true } },
      project: { select: { name: true } },
    },
  });
  return NextResponse.json({
    offers: rows.map((o) => ({
      id: o.id,
      title: o.title,
      priceCents: o.priceCents,
      currency: o.currency,
      status: o.status,
      paymentMode: o.paymentMode,
      paidAt: o.paidAt?.toISOString() ?? null,
      userEmail: o.user.email,
      userName: o.user.name,
      workspaceName: o.project.name,
      createdAt: o.createdAt.toISOString(),
    })),
  });
}
