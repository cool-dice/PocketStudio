import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  inviteLifecycle,
  sanitizeInviteRole,
} from "@/lib/invite-status";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/** Public peek so /login?invite= can show used/expired copy before submit. */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const trimmed = (token ?? "").trim();
  if (trimmed.length < 8 || trimmed.length > 80) {
    return NextResponse.json({ status: "invalid" as const });
  }
  const row = await db.invite.findUnique({ where: { token: trimmed } });
  const status = inviteLifecycle(row);
  if (status === "invalid" || !row) {
    return NextResponse.json({ status: "invalid" as const });
  }
  return NextResponse.json({
    status,
    role: sanitizeInviteRole(row.role),
    email: row.email,
  });
}
