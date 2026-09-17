import { NextResponse } from "next/server";
import { getUserFromRequest, signWsToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const token = await signWsToken(session);
  return NextResponse.json({ token, expiresIn: 60 });
}
