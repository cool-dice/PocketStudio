import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { readJsonBody } from "@/lib/json-body-limit";

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

/** Admin: mark a payout paid or failed. Status in the studio — not a bank transfer. */
export async function PATCH(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const body = jsonRead.value as {
    id?: string;
    status?: string;
  };
  if (!body.id || (body.status !== "paid" && body.status !== "failed")) {
    return NextResponse.json({ error: "Нужны id и status paid|failed" }, { status: 400 });
  }
  const existing = await db.payout.findUnique({
    where: { id: body.id },
    select: { id: true, note: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Выплата не найдена" }, { status: 404 });
  }
  const note =
    existing.note?.trim() ||
    (body.status === "paid"
      ? "Помечено админом (симуляция, не банковский перевод)"
      : "Помечено как сбой (симуляция, перевод не выполнялся)");
  const row = await db.payout.update({
    where: { id: existing.id },
    data: { status: body.status, note },
  });
  return NextResponse.json({
    payout: {
      id: row.id,
      status: row.status,
      amountCents: row.amountCents,
      note: row.note,
    },
    hint: "Статус в студии изменён. Банковский перевод не выполнялся.",
  });
}
