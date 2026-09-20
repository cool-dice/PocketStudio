import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Admin: list payouts to mark paid/failed. Status only — not a bank transfer. */
export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const rows = await db.payout.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });
  return NextResponse.json({
    payouts: rows.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      note: p.note,
      providerRef: p.providerRef,
      userEmail: p.user.email,
      userName: p.user.name,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
