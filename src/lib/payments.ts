/**
 * Payment adapter (F10).
 * Default mode is `simulated` — marks offers paid without a card network.
 * `live` requires PAYMENTS_API_KEY (or admin-stored key); without it we
 * refuse instead of faking a host publish.
 */

export type PaymentMode = "simulated" | "live";

export interface ChargeResult {
  ok: boolean;
  mode: PaymentMode;
  providerRef: string;
  error?: string;
}

function liveKey(): string {
  return (process.env.PAYMENTS_API_KEY ?? "").trim();
}

export function resolvePaymentMode(requested?: string | null): PaymentMode {
  return requested === "live" ? "live" : "simulated";
}

export async function chargeOffer(opts: {
  offerId: string;
  amountCents: number;
  currency: string;
  mode: PaymentMode;
}): Promise<ChargeResult> {
  if (opts.mode === "simulated") {
    return {
      ok: true,
      mode: "simulated",
      providerRef: `sim_${opts.offerId}_${Date.now().toString(36)}`,
    };
  }
  const key = liveKey();
  if (!key) {
    return {
      ok: false,
      mode: "live",
      providerRef: "",
      error:
        "Живой платёж не настроен: задайте PAYMENTS_API_KEY или отметьте оплату в админке (симулированный режим).",
    };
  }
  // Live adapter is a stub with a real-key slot: we do not invent Stripe
  // charges. The product screens still function via simulated + admin mark.
  return {
    ok: false,
    mode: "live",
    providerRef: "",
    error:
      "Ключ задан, но live-провайдер ещё не подключён. Используйте симуляцию или «отметить оплачено» в админке.",
  };
}
