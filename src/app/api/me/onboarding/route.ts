import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.sub },
    select: { onboardingDone: true },
  });
  return NextResponse.json({
    onboardingDone: Boolean(user?.onboardingDone),
  });
}

const patchSchema = z.object({
  onboardingDone: z.boolean(),
});

export async function PATCH(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  await db.user.update({
    where: { id: session.sub },
    data: { onboardingDone: parsed.data.onboardingDone },
  });
  return NextResponse.json({ onboardingDone: parsed.data.onboardingDone });
}
