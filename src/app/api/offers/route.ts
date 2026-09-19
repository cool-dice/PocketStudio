import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { ensureWorkspace } from "@/lib/workspace-api";
import { resolvePaymentMode } from "@/lib/payments";

export const dynamic = "force-dynamic";

export interface OfferDto {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  status: string;
  paymentMode: string;
  providerRef: string | null;
  paidAt: string | null;
  createdAt: string;
}

function offerDto(row: {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: string;
  status: string;
  paymentMode: string;
  providerRef: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): OfferDto {
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    status: row.status,
    paymentMode: row.paymentMode,
    providerRef: row.providerRef,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const rows = await db.offer.findMany({
    where: {
      userId: session.sub,
      ...(projectId ? { projectId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ offers: rows.map(offerDto) });
}

const createSchema = z.object({
  projectId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  priceCents: z.number().int().min(0).max(10_000_000),
  currency: z.string().trim().min(3).max(8).optional(),
  paymentMode: z.enum(["simulated", "live"]).optional(),
});

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }
  const check = await ensureWorkspace(req, parsed.data.projectId);
  if (!check.ok) return check.response;
  const row = await db.offer.create({
    data: {
      userId: check.userId,
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priceCents: parsed.data.priceCents,
      currency: parsed.data.currency ?? "RUB",
      status: "listed",
      paymentMode: resolvePaymentMode(parsed.data.paymentMode),
    },
  });
  return NextResponse.json({ offer: offerDto(row) }, { status: 201 });
}
