import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/json-body-limit";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { modelDto } from "@/lib/ai/dto";
import { modelCreateSchema } from "@/lib/ai/provider-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const provider = await db.aiProvider.findFirst({
    where: { id, userId: null },
    select: { id: true },
  });
  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = modelCreateSchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  try {
    const row = await db.aiModel.create({
      data: {
        providerId: id,
        modelId: parsed.data.modelId,
        displayName: parsed.data.displayName,
        capChat: parsed.data.capChat ?? true,
        capImage: parsed.data.capImage ?? false,
        capTts: parsed.data.capTts ?? false,
        capAsr: parsed.data.capAsr ?? false,
        capEmbeddings: parsed.data.capEmbeddings ?? false,
        enabled: parsed.data.enabled ?? true,
      },
    });
    return NextResponse.json({ model: modelDto(row) }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Модель с таким id уже есть у этого провайдера" },
      { status: 409 },
    );
  }
}
