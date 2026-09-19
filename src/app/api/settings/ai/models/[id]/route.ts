import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { modelDto } from "@/lib/ai/dto";
import { modelUpdateSchema } from "@/lib/ai/provider-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.aiModel.findFirst({
    where: { id, provider: { userId: session.sub } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Модель не найдена" }, { status: 404 });
  }

  const parsed = modelUpdateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  const row = await db.aiModel.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ model: modelDto(row) });
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.aiModel.findFirst({
    where: { id, provider: { userId: session.sub } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Модель не найдена" }, { status: 404 });
  }

  await db.aiModel.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
