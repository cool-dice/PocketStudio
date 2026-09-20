/**
 * User-facing copy for Next not-found / error boundaries.
 * Never echo Error.message, stack, or Next digest — those can leak
 * internals (paths, Prisma, DATABASE_URL).
 */

export const ROUTE_HOME_HREF = "/";
export const ROUTE_LOGIN_HREF = "/login";

export const ROUTE_HOME_LABEL = "На главную";
export const ROUTE_LOGIN_LABEL = "Войти";

export const NOT_FOUND_TITLE = "Страница не найдена";
export const NOT_FOUND_BODY =
  "Такой страницы нет — возможно, ссылка устарела или адрес набран с ошибкой.";
export const NOT_FOUND_META_TITLE = "Страница не найдена — PocketStudio";

export const ROUTE_ERROR_TITLE = "Что-то пошло не так";
export const ROUTE_ERROR_BODY =
  "Не удалось открыть эту страницу. Попробуйте ещё раз или вернитесь на главную.";
export const ROUTE_ERROR_RETRY = "Попробовать снова";

export type RouteErrorKind = "not-found" | "error";

export type RouteErrorViewModel = {
  kind: RouteErrorKind;
  title: string;
  body: string;
  homeHref: string;
  loginHref: string;
  homeLabel: string;
  loginLabel: string;
  retryLabel: string | null;
};

/** Always canned Russian — `_error` is ignored on purpose. */
export function routeErrorViewModel(
  kind: RouteErrorKind,
  _error?: unknown,
): RouteErrorViewModel {
  void _error;
  if (kind === "not-found") {
    return {
      kind,
      title: NOT_FOUND_TITLE,
      body: NOT_FOUND_BODY,
      homeHref: ROUTE_HOME_HREF,
      loginHref: ROUTE_LOGIN_HREF,
      homeLabel: ROUTE_HOME_LABEL,
      loginLabel: ROUTE_LOGIN_LABEL,
      retryLabel: null,
    };
  }
  return {
    kind,
    title: ROUTE_ERROR_TITLE,
    body: ROUTE_ERROR_BODY,
    homeHref: ROUTE_HOME_HREF,
    loginHref: ROUTE_LOGIN_HREF,
    homeLabel: ROUTE_HOME_LABEL,
    loginLabel: ROUTE_LOGIN_LABEL,
    retryLabel: ROUTE_ERROR_RETRY,
  };
}

export function routeErrorUserBlob(kind: RouteErrorKind, error?: unknown): string {
  const model = routeErrorViewModel(kind, error);
  return [model.title, model.body, model.homeLabel, model.loginLabel, model.retryLabel ?? ""]
    .join("\n");
}

const LEAK_RE =
  /digest|stack|DATABASE_URL|AUTH_SECRET|passwordHash|postgresql:\/\/|Something went wrong|This page could not be found|Internal Server Error|at\s+\S+\s+\([^)]+:\d+:\d+\)/i;

export function routeErrorLooksLikeLeak(value: unknown): boolean {
  const blob = typeof value === "string" ? value : JSON.stringify(value);
  return LEAK_RE.test(blob);
}

/** Client/server log: canned tag only, never digest/message/stack. */
export function logRouteError(_error: unknown): void {
  void _error;
  console.error("[route-error]");
}
