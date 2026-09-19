import { NextResponse } from "next/server";

import { firstUserBecomesAdmin } from "@/lib/auth-bootstrap";

export const dynamic = "force-dynamic";

/** Public: whether the next open registration becomes studio admin. No secrets. */
export async function GET() {
  const flag = await firstUserBecomesAdmin();
  return NextResponse.json(
    { firstUserBecomesAdmin: flag },
    { headers: { "cache-control": "no-store" } },
  );
}
