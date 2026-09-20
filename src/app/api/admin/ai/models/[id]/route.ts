import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/json-body-limit";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { modelDto } from "@/lib/ai/dto";
import { modelUpdateSchema } from "@/lib/ai/provider-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const existing = await db.aiModel.findFirst({
    where: { id, provider: { userId: null } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Модель не найдена" }, { status: 404 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = modelUpdateSchema.safeParse(jsonRead.value);
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
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const existing = await db.aiModel.findFirst({
    where: { id, provider: { userId: null } },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Модель не найдена" }, { status: 404 });
  }

  try {
    await db.aiModel.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Модель назначена инструменту — сначала смените значение по умолчанию" },
      { status: 409 },
    );
  }
}
