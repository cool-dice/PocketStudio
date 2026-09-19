import { describe, expect, test } from "bun:test";

import { chargeOffer } from "./payments";

describe("chargeOffer adapter", () => {
  test("simulated marks paid without a card network", async () => {
    const result = await chargeOffer({
      offerId: "off_sim",
      amountCents: 1000,
      currency: "RUB",
      mode: "simulated",
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("simulated");
    expect(result.providerRef).toMatch(/^sim_/);
  });

  test("live never invents a successful card charge", async () => {
    const prev = process.env.PAYMENTS_API_KEY;
    delete process.env.PAYMENTS_API_KEY;
    const noKey = await chargeOffer({
      offerId: "off_live",
      amountCents: 1000,
      currency: "RUB",
      mode: "live",
    });
    expect(noKey.ok).toBe(false);
    expect(noKey.error).toMatch(/не настроен|админ/i);

    process.env.PAYMENTS_API_KEY = "pk_test_not_a_real_charge";
    const withKey = await chargeOffer({
      offerId: "off_live",
      amountCents: 1000,
      currency: "RUB",
      mode: "live",
    });
    expect(withKey.ok).toBe(false);
    expect(withKey.error).toMatch(/не подключ/i);
    expect(withKey.providerRef).toBe("");

    if (prev === undefined) delete process.env.PAYMENTS_API_KEY;
    else process.env.PAYMENTS_API_KEY = prev;
  });
});
