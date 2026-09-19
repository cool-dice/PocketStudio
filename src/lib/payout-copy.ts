/**
 * Honest monetize / payout labels. Simulated money is never «выплачено картой».
 */

export function offerPaidLabel(paymentMode: string): string {
  return paymentMode === "live"
    ? "оплачено (не картой: симуляция или пометка админа)"
    : "оплачено (симуляция)";
}

export function payoutStatusLabel(status: string): string {
  if (status === "paid") return "выплачено (симуляция)";
  if (status === "failed") return "ошибка";
  return "к выплате";
}

export function offerCheckoutSuccessCopy(paymentMode: string): string {
  return paymentMode === "live"
    ? "Сервер принял live-запрос. Карту мы всё равно не проводим."
    : "Симулированная оплата прошла, выплата в кабинете";
}

export function monetizePaymentsHint(): string {
  return "Офферы и кабинет выплат. Симуляция отмечает оплату без карты. Live без эквайера честно откажет — даже если ключ задан.";
}

export function adminPaymentsHint(): string {
  return "Карта не списывается. «Отметить оплачено» — симуляция: оффер paid и выплата в кабинете автора.";
}

export function adminPayoutHint(): string {
  return "«Отметить выплаченным» меняет статус в студии. Банковский перевод не выполняется.";
}
