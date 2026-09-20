/**
 * Gateway errors with Russian user-facing messages.
 * Safe to import from Next and agent-service (no aliases).
 */

export class GatewayError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
  }
}

export function isGatewayError(err: unknown): err is GatewayError {
  return err instanceof GatewayError;
}

/** Strip anything that looks like an API key from a string we might log. */
export function redactSecrets(text: string): string {
  return text
    .replace(/sk-[a-zA-Z0-9_\-]{8,}/g, "sk-…")
    .replace(/Bearer\s+[A-Za-z0-9._\-]{8,}/gi, "Bearer …")
    .replace(/x-api-key["'\s:=]+[A-Za-z0-9._\-]{8,}/gi, "x-api-key=…");
}

export function mapProviderHttpError(status: number, bodyText: string): GatewayError {
  const snippet = redactSecrets(bodyText).replace(/\s+/g, " ").trim().slice(0, 180);
  if (status === 401 || status === 403) {
    return new GatewayError(
      "Неверный ключ API или нет доступа к провайдеру",
      401,
    );
  }
  if (status === 429) {
    return new GatewayError(
      "Провайдер временно ограничил запросы — подождите и попробуйте снова",
      429,
    );
  }
  if (status === 400) {
    return new GatewayError(
      snippet
        ? `Провайдер отклонил запрос: ${snippet}`
        : "Провайдер отклонил запрос — проверьте модель и параметры",
      400,
    );
  }
  if (status >= 500) {
    return new GatewayError("Провайдер недоступен. Попробуйте позже", 502);
  }
  return new GatewayError(
    snippet
      ? `Ошибка провайдера (${status}): ${snippet}`
      : `Ошибка провайдера (${status})`,
    502,
  );
}
