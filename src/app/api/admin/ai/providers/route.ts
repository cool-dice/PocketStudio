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
  providerCreateSchema,
} from "@/lib/ai/provider-input";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const providers = await db.aiProvider.findMany({
      where: { userId: null },
      include: { models: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ providers: providers.map(providerDto) });
  } catch {
    console.error("[admin/ai/providers] list failed");
    return NextResponse.json(
      { error: "Не удалось загрузить провайдеров" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const jsonRead = await readJsonBody(req, { fallback: {} });
  if (!jsonRead.ok) return jsonRead.response;
  const parsed = providerCreateSchema.safeParse(jsonRead.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  try {
    const kind = parseKind(parsed.data.kind);
    const baseUrl = parseBaseUrl(parsed.data.baseUrl);
    const extraHeaders = parseExtraHeadersJson(parsed.data.extraHeaders);
    const row = await db.aiProvider.create({
      data: {
        userId: null,
        kind,
        name: parsed.data.name,
        baseUrl,
        apiKey: encryptSecret(parsed.data.apiKey),
        apiKeyLast4: last4OfKey(parsed.data.apiKey),
        enabled: parsed.data.enabled ?? true,
        visibleToUsers: parsed.data.visibleToUsers ?? true,
        markupPercent: parsed.data.markupPercent ?? null,
        markupMultiplier: parsed.data.markupMultiplier ?? null,
        extraHeaders,
      },
      include: { models: true },
    });
    await db.auditLog.create({
      data: {
        userId: guard.userId,
        action: "admin.ai.provider.create",
        entity: "aiProvider",
        entityId: row.id,
      },
    }).catch(() => {});
    return NextResponse.json({ provider: providerDto(row) }, { status: 201 });
  } catch (err) {
    if (isGatewayError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[admin/ai/providers] create failed");
    return NextResponse.json({ error: "Не удалось сохранить провайдера" }, { status: 500 });
  }
}
