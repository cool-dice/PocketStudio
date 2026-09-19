import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
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

export async function POST(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const parsed = providerCreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректный запрос" },
      { status: 400 },
    );
  }

  try {
    const row = await db.aiProvider.create({
      data: {
        userId: session.sub,
        kind: parseKind(parsed.data.kind),
        name: parsed.data.name,
        baseUrl: parseBaseUrl(parsed.data.baseUrl),
        apiKey: encryptSecret(parsed.data.apiKey),
        apiKeyLast4: last4OfKey(parsed.data.apiKey),
        enabled: parsed.data.enabled ?? true,
        visibleToUsers: false,
        markupPercent: null,
        markupMultiplier: null,
        extraHeaders: parseExtraHeadersJson(parsed.data.extraHeaders),
      },
      include: { models: true },
    });
    return NextResponse.json({ provider: providerDto(row) }, { status: 201 });
  } catch (err) {
    if (isGatewayError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Не удалось сохранить провайдера" }, { status: 500 });
  }
}
