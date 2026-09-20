import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { publicUserDto } from "@/lib/user-dto";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.sub } });
  if (!user) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  return NextResponse.json({ user: publicUserDto(user) });
}
