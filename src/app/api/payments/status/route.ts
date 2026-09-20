import { NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/auth";
import { resolvePaymentMode } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  const hasLiveKey = Boolean((process.env.PAYMENTS_API_KEY ?? "").trim());
  return NextResponse.json({
    defaultMode: resolvePaymentMode(),
    liveKeyConfigured: hasLiveKey,
    modes: [
      {
        id: "simulated",
        label: "Симуляция",
        hint: "Оффер помечается оплаченным без карты. Для песочницы и тестов.",
      },
      {
        id: "live",
        label: "Live",
        hint: hasLiveKey
          ? "Ключ PAYMENTS_API_KEY задан, но эквайринг ещё не подключён — оплата вернёт честный отказ."
          : "Задайте PAYMENTS_API_KEY, иначе live-режим откажет без фейкового успеха.",
      },
    ],
  });
}
