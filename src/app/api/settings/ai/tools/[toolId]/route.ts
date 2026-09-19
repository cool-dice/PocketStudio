import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { isGatewayError } from "@/lib/ai/errors";
import { requireToolId, userToolOverrideSchema } from "@/lib/ai/provider-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ toolId: string }> };

export async function PUT(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { toolId: rawToolId } = await params;

  const parsed = userToolOverrideSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  try {
    const toolId = requireToolId(rawToolId);
    const modelId = parsed.data.modelId;

    if (modelId) {
      const model = await db.aiModel.findFirst({
        where: {
          id: modelId,
          enabled: true,
          provider: {
            enabled: true,
            OR: [
              { userId: session.sub },
              { userId: null, visibleToUsers: true },
            ],
          },
        },
        select: { id: true },
      });
      if (!model) {
        return NextResponse.json(
          { error: "Модель недоступна — выберите другую или значение студии" },
          { status: 404 },
        );
      }
    }

    await db.userToolModel.upsert({
      where: { userId_toolId: { userId: session.sub, toolId } },
      create: { userId: session.sub, toolId, modelId },
      update: { modelId },
    });

    return NextResponse.json({ ok: true, toolId, modelId });
  } catch (err) {
    if (isGatewayError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Не удалось сохранить выбор модели" }, { status: 500 });
  }
}
