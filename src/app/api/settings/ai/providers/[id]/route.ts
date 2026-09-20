import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/json-body-limit";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
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
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.aiProvider.findFirst({
    where: { id, userId: session.sub },
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
    return NextResponse.json({ error: "Не удалось обновить провайдера" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await db.aiProvider.findFirst({
    where: { id, userId: session.sub },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Провайдер не найден" }, { status: 404 });
  }

  await db.aiProvider.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
