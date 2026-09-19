import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const rows = await db.payout.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    payouts: rows.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      providerRef: p.providerRef,
      note: p.note,
      createdAt: p.createdAt.toISOString(),
    })),
    totalPendingCents: rows
      .filter((p) => p.status === "pending")
      .reduce((sum, p) => sum + p.amountCents, 0),
    totalPaidCents: rows
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amountCents, 0),
  });
}

/** Admin: mark a payout paid. */
export async function PATCH(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
  };
  if (!body.id || (body.status !== "paid" && body.status !== "failed")) {
    return NextResponse.json({ error: "Нужны id и status paid|failed" }, { status: 400 });
  }
  try {
    const row = await db.payout.update({
      where: { id: body.id },
      data: { status: body.status },
    });
    return NextResponse.json({
      payout: {
        id: row.id,
        status: row.status,
        amountCents: row.amountCents,
      },
    });
  } catch {
    return NextResponse.json({ error: "Выплата не найдена" }, { status: 404 });
  }
}
