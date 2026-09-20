import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { testConnection } from "@/lib/ai/connector";
import { isGatewayError } from "@/lib/ai/errors";
import { routeForProviderTest } from "@/lib/ai/resolve";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const route = await routeForProviderTest(db, id, session.sub);
    const result = await testConnection(route);
    return NextResponse.json(result);
  } catch (err) {
    if (isGatewayError(err)) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Не удалось проверить соединение" },
      { status: 502 },
    );
  }
}
