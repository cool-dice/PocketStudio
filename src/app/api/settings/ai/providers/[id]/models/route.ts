import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { modelDto } from "@/lib/ai/dto";
import { modelCreateSchema } from "@/lib/ai/provider-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const provider = await db.aiProvider.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!provider) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  const parsed = modelCreateSchema.safeParse(await req.json().catch(() => ({})));
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
