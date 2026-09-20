import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/json-body-limit";

import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { encryptSecret, last4OfKey } from "@/lib/ai/crypto";
import { providerDto } from "@/lib/ai/dto";
import { isGatewayError } from "@/lib/ai/errors";
import {
  parseBaseUrl,
  parseExtraHeadersJson,
  parseKind,
  providerUpdateSchema,
} from "@/lib/ai/provider-input";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const existing = await db.aiProvider.findFirst({
    where: { id, userId: null },
  });
  if (!existing) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = providerUpdateSchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  try {
    const data: Record<string, unknown> = {};
    if (parsed.data.kind) data.kind = parseKind(parsed.data.kind);
    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.baseUrl) data.baseUrl = parseBaseUrl(parsed.data.baseUrl);
    if (parsed.data.apiKey) {
      data.apiKey = encryptSecret(parsed.data.apiKey);
      data.apiKeyLast4 = last4OfKey(parsed.data.apiKey);
    }
    if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
    if (parsed.data.visibleToUsers !== undefined) {
      data.visibleToUsers = parsed.data.visibleToUsers;
    }
    if (parsed.data.markupPercent !== undefined) {
      data.markupPercent = parsed.data.markupPercent;
    }
    if (parsed.data.markupMultiplier !== undefined) {
      data.markupMultiplier = parsed.data.markupMultiplier;
    }
    if (parsed.data.extraHeaders !== undefined) {
      data.extraHeaders = parseExtraHeadersJson(parsed.data.extraHeaders);
    }

    const row = await db.aiProvider.update({
      where: { id },
      data,
      include: { models: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ provider: providerDto(row) });
  } catch (err) {
    if (isGatewayError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/ai/providers] update failed");
    return NextResponse.json({ error: "Не удалось обновить провайдера" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const existing = await db.aiProvider.findFirst({
    where: { id, userId: null },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  try {
    await db.aiProvider.delete({ where: { id } });
    await db.auditLog.create({
      data: {
        userId: guard.userId,
        action: "admin.ai.provider.delete",
        entity: "aiProvider",
        entityId: id,
      },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Нельзя удалить провайдера: модель назначена инструменту по умолчанию. Сначала смените назначение.",
      },
      { status: 409 },
    );
  }
}
