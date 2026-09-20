import { describe, expect, test } from "bun:test";

import {
  adminPaymentsHint,
  adminPayoutHint,
  monetizePaymentsHint,
  offerCheckoutSuccessCopy,
  offerPaidLabel,
  payoutStatusLabel,
} from "./payout-copy";

describe("payout copy never claims a card payout for simulation", () => {
  test("paid offer labels", () => {
    expect(offerPaidLabel("simulated")).toBe("оплачено (симуляция)");
    expect(offerPaidLabel("live")).toMatch(/не картой/i);
    expect(offerPaidLabel("simulated")).not.toMatch(/картой/);
    expect(payoutStatusLabel("paid")).toBe("выплачено (симуляция)");
    expect(payoutStatusLabel("paid")).not.toMatch(/картой/);
    expect(payoutStatusLabel("pending")).toBe("к выплате");
  });

  test("checkout and tab hints stay simulated", () => {
    expect(offerCheckoutSuccessCopy("simulated")).toMatch(/симул/i);
    expect(offerCheckoutSuccessCopy("simulated")).not.toMatch(/картой/);
    expect(monetizePaymentsHint()).toMatch(/без карты/i);
    expect(adminPaymentsHint()).toMatch(/карта не списывается/i);
    expect(adminPaymentsHint()).not.toMatch(/выплачено картой/i);
    expect(adminPayoutHint()).toMatch(/не выполняется/i);
    expect(adminPayoutHint()).not.toMatch(/банковский перевод выполняется/i);
  });
});
