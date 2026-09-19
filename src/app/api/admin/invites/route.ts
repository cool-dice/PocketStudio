import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const rows = await db.invite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    invites: rows.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      token: i.token,
      usedAt: i.usedAt?.toISOString() ?? null,
      expiresAt: i.expiresAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
  });
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["client", "admin"]).optional(),
});

export async function POST(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный email" },
      { status: 400 },
    );
  }
  const token = randomBytes(18).toString("hex");
  const row = await db.invite.create({
    data: {
      email: parsed.data.email,
      role: parsed.data.role ?? "client",
      token,
      createdBy: guard.userId,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });
  return NextResponse.json(
    {
      invite: {
        id: row.id,
        email: row.email,
        role: row.role,
        token: row.token,
        createdAt: row.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
