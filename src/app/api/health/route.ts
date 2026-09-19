// GET /api/health — public liveness. { status: "up" | "down" } only.
// Never returns DATABASE_URL, AUTH_SECRET, Prisma text, or stacks.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { appHealthJson, probeUp } from "@/lib/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "cache-control": "no-store" };

export async function GET() {
  try {
    const up = await probeUp(() => db.$queryRaw`SELECT 1`);
    return NextResponse.json(appHealthJson(up), {
      status: up ? 200 : 503,
      headers: NO_STORE,
    });
  } catch {
    console.error("[health] probe failed");
    return NextResponse.json(appHealthJson(false), {
      status: 503,
      headers: NO_STORE,
    });
  }
}
