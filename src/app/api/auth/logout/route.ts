import { NextResponse } from "next/server";
import { clearSessionCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookies(res);
  return res;
}
